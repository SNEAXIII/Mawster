from sqlmodel import create_engine, Session
from src.enums.Roles import Roles
from src.security.secrets import SECRET
from src.models import User

sync_engine = create_engine(
    f"mysql+pymysql://{SECRET.MARIADB_USER}:{SECRET.MARIADB_PASSWORD}@{SECRET.MARIADB_HOST}/{SECRET.MARIADB_DATABASE}",
)

master_account = "misterbalise"

admin = User(
    email="misterbalise2@gmail.com",
    login=master_account,
    discord_id="admin_discord_id_placeholder",
    role=Roles.ADMIN,
)


def load_sample_data():
    try:
        with Session(sync_engine) as session:
            session.add(admin)
            session.commit()
            print("✅ Admin loaded with success !")
        print("✅ Sample data loaded with success !")
        print(f"⚠ Master account '{master_account}' created. Update discord_id to link with your Discord account.")

    except Exception as e:
        session.rollback()
        print(f"❌ Error loading sample data : {e}")
        raise


if __name__ == "__main__":
    load_sample_data()
