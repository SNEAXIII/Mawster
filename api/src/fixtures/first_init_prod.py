from sqlmodel import create_engine, Session
from typing import List
from src.enums.Roles import Roles
from src.security.secrets import SECRET
from src.models import Category, User, ExerciseCoherenceCardiac

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

def create_sample_categories():
    return [
        Category(label="Actualités"),
        Category(label="Bien-être"),
        Category(label="Conseils"),
        Category(label="Méditation"),
        Category(label="Respiration"),
        Category(label="Spiritualité"),
    ]

def create_sample_exercises() -> List[ExerciseCoherenceCardiac]:
    return [
        ExerciseCoherenceCardiac(
            name="Respiration 748",
            duration_inspiration=7,
            duration_apnea=4,
            duration_expiration=8,
            number_cycles=15,  # (7+4+8)*15 ~= 300 seconds
        ),
        ExerciseCoherenceCardiac(
            name="Respiration 505",
            duration_inspiration=5,
            duration_apnea=0,
            duration_expiration=5.0,
            number_cycles=30,  # (5+5)*30 ~= 300 seconds
        ),
        ExerciseCoherenceCardiac(
            name="Respiration 406",
            duration_inspiration=5,
            duration_apnea=0,
            duration_expiration=5.0,
            number_cycles=30,  # (4+6)*30 ~= 300 seconds
        ),
    ]

def load_sample_data():
    try:
        with Session(sync_engine) as session:
            session.add(admin)
            print("✅ Admin loaded with success !")
            categories = create_sample_categories()
            for elem in categories:
                session.add(elem)
            session.commit()
            print("✅ Categories loaded with success !")
            session.commit()
            print("✅ Articles loaded with success !")
            exercises = create_sample_exercises()
            for elem in exercises:
                session.add(elem)
            session.commit()
            print("✅ Exercises loaded with success !")
        print("✅ Sample data loaded with success !")
        print(f"⚠ Master account '{master_account}' created. Update discord_id to link with your Discord account.")


    except Exception as e:
        session.rollback()
        print(f"❌ Error loading sample data : {e}")
        raise


if __name__ == "__main__":
    load_sample_data()
