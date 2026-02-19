from datetime import datetime
from itertools import product
from random import randint
from faker import Faker
from sqlmodel import Session
from typing import List
from enum import Enum
from src.enums.Roles import Roles
from src.models import User, LoginLog
from src.fixtures import sync_engine

fake = Faker(locale="en")


class States(str, Enum):
    ACTIVE = "active"
    DISABLED = "disabled"
    DELETED = "deleted"


NOW = datetime.now()


admin = User(
    email="admin@email.com",
    login="admin",
    discord_id="sample_admin_discord_id",
    role=Roles.ADMIN,
)
user = User(
    email="user@email.com",
    login="user",
    discord_id="sample_user_discord_id",
    role=Roles.USER,
)


def create_sample_users(rolls: int) -> List[User]:
    states = States.__members__.values()
    roles = Roles.__members__.values()

    users = []
    for role, state, index in product(roles, states, range(rolls)):
        id_bonus = f"{randint(0, 9999)}".zfill(4)  # NOSONAR
        name = f"{(fake.first_name())}_{id_bonus}"
        email = f"{name}@gmail.com"
        discord_id = f"sample_discord_{name}_{id_bonus}"
        user = User(
            login=name,
            email=email,
            role=role,
            discord_id=discord_id,
            created_at=fake.date_time(end_datetime=NOW),
        )
        match state:
            case States.DELETED:
                user.deleted_at = fake.date_time(end_datetime=NOW)
            case States.DISABLED:
                user.disabled_at = fake.date_time(end_datetime=NOW)
        users.append(user)
    return users


def create_sample_login_logs(users: List[User], rolls: int) -> List[LoginLog]:
    logs = []
    for user, _ in product(users, range(rolls)):
        date = fake.date_time(end_datetime=NOW)
        user.last_login_date = date
        logs.append(
            LoginLog(
                id_user=user.id,
                date_connexion=fake.date_time(end_datetime=NOW),
            )
        )
    return logs


def load_sample_data():
    try:
        with Session(sync_engine) as session:
            session.add(admin)
            session.add(user)
            print("🚀 Creating users")
            all_users = create_sample_users(rolls=5)
            for elem in all_users:
                session.add(elem)
            session.commit()
            print("✅ Users loaded with success !")
            login_logs = create_sample_login_logs(all_users, rolls=4)
            for elem in login_logs:
                session.add(elem)
            session.commit()
            print("✅ Login logs loaded with success !")

        print("✅ Sample data loaded with success !")

    except Exception as e:
        session.rollback()
        print(f"❌ Error loading sample data : {e}")
        raise


if __name__ == "__main__":
    load_sample_data()
