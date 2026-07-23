from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List, Optional

class Settings(BaseSettings):
    mongodb_uri: str = Field(..., env='MONGODB_URI')
    mongodb_db: str = Field(..., env='MONGODB_DB')

    secret_key: str = Field(..., env='SECRET_KEY')
    jwt_algorithm: str = Field('HS256', env='JWT_ALGORITHM')
    access_token_expire_minutes: int = Field(60, env='ACCESS_TOKEN_EXPIRE_MINUTES')
    password_setup_token_expire_minutes: int = Field(60, env='PASSWORD_SETUP_TOKEN_EXPIRE_MINUTES')

    
    smtp_host: Optional[str] = Field(None, env='SMTP_HOST')
    smtp_port: Optional[int] = Field(None, env='SMTP_PORT')
    smtp_user: Optional[str] = Field(None, env='SMTP_USER')
    smtp_password: Optional[str] = Field(None, env='SMTP_PASSWORD')
    mail_from: Optional[str] = Field(None, env='MAIL_FROM')

    frontend_base_url: Optional[str] = Field(None, env='FRONTEND_BASE_URL')
    cors_origins: Optional[str] = Field(None, env='CORS_ORIGINS')

    razorpay_key_id: Optional[str] = Field(None, env='RAZORPAY_KEY_ID')
    razorpay_key_secret: Optional[str] = Field(None, env='RAZORPAY_KEY_SECRET')
    razorpay_webhook_secret: Optional[str] = Field(None, env='RAZORPAY_WEBHOOK_SECRET')

    superadmin_email: str = Field(..., env='SUPERADMIN_EMAIL')
    superadmin_name: str = Field(..., env='SUPERADMIN_NAME')
    superadmin_password: str = Field(..., env='SUPERADMIN_PASSWORD')


    cloudinary_cloud_name: str
    cloudinary_api_key: str
    cloudinary_api_secret: str

    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'
        extra = "ignore"  

settings = Settings()


def frontend_url(path: str = '') -> str:
    base = (settings.frontend_base_url or 'http://localhost:5173').rstrip('/')
    if not path:
        return base
    normalized_path = path.lstrip('/')
    return f'{base}/{normalized_path}'


def allowed_frontend_origins() -> List[str]:
    origins = {
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://rms-2-1.onrender.com',
	'https://rms.raphaaa.com',
    }
    if settings.frontend_base_url:
        origins.add(settings.frontend_base_url.rstrip('/'))
    if settings.cors_origins:
        origins.update(
            origin.strip().rstrip('/')
            for origin in settings.cors_origins.split(',')
            if origin.strip()
        )
    return sorted(origins)
