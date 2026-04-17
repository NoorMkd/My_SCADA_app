# ============================================================
# auth.py (Router)
# The API endpoints that React calls to log in and register.
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, models, schemas
from app.database import get_db
from app.auth import verify_password, create_access_token, check_admin_or_supervisor, get_current_user

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)

@router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user: schemas.UserCreate, db: AsyncSession = Depends(get_db)):
    """
    Creates a new user. The very first user registering 
    is automatically assigned the 'admin' role. All others 
    will become 'operator' normally, or retain whatever the admin passes.
    """
    # Check if username exists
    existing_username = await crud.get_user_by_username(db, username=user.username)
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken."
        )
        
    # Check if email exists
    existing_email = await crud.get_user_by_email(db, email=user.email)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address already registered."
        )

    # Automatically make the first user an admin, otherwise block admin creation.
    user_count = await crud.count_users(db)
    if user_count == 0:
        user.role = "admin"
    else:
        # If not the first user, ensure they cannot falsely claim to be an admin/supervisor
        # In a real app, an existing admin would have to create or upgrade them.
        if user.role in "admin":
            user.role = ["operator","Technician", "supervisor"]

    # Hand off to CRUD which hashes the pass and inserts to DB
    new_user = await crud.create_user(db, user)
    return new_user


@router.post("/login", response_model=schemas.Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    React sends a username + password here.
    If correct, we reply with a string (JWT).
    React uses this string to prove it is logged in on future requests.
    """
    # 1. Find user by username
    user = await crud.get_user_by_username(db, form_data.username)
    
    # 2. Check if user exists & password hash matches what they typed
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # 3. Check if account was softly deleted or banned
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account."
        )

    # 4. Generate the JWT! We encode their ID, username, and role.
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "username": user.username,
            "role": user.role
        }
    )
    
    # Return it exactly how FastAPI / OAuth2 expects
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/users", response_model=list[schemas.UserResponse])
async def get_all_users(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)  # Any logged in user
):
    """
    Returns a list of all users in the system.
    """
    users = await crud.get_all_users(db)
    return users


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_endpoint(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(check_admin_or_supervisor)  # Admin or supervisor ONLY!
):
    """
    DELETE /api/auth/users/4
    
    Deletes a specific user by their ID. 
    Only Admins and Supervisors are allowed to use this endpoint.
    """
    # Prevent the admin from accidentally deleting themselves
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account."
        )

    success = await crud.delete_user(db, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found."
        )
    return None
