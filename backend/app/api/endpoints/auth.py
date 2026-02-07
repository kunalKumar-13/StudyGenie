"""Authentication endpoints: register and login."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db, UserDB
from app.core.auth import hash_password, verify_password, create_access_token
from app.models.chat import RegisterRequest, LoginResponse, UserResponse

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new user account."""
    existing = db.query(UserDB).filter(UserDB.username == request.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    if len(request.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    
    user = UserDB(
        id=str(uuid.uuid4()),
        username=request.username,
        hashed_password=hash_password(request.password),
        full_name=request.full_name or request.username,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse(id=user.id, username=user.username, full_name=user.full_name)


@router.post("/login", response_model=LoginResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Authenticate and return a JWT token."""
    user = db.query(UserDB).filter(UserDB.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = create_access_token(data={"sub": user.id})
    return LoginResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
    )
