import uuid


# User
USER_ID = uuid.uuid4()
LOGIN = "login"
EMAIL = f"{LOGIN}@gmail.com"
USER_LOGIN  = "user"
USER_EMAIL = f"{USER_LOGIN}@gmail.com"
ADMIN_LOGIN  = "admin"
ADMIN_EMAIL  = f"{ADMIN_LOGIN}@gmail.com"

# Second user (for multi-user tests)
USER2_ID = uuid.uuid4()
USER2_LOGIN = "user2"
USER2_EMAIL = f"{USER2_LOGIN}@gmail.com"
DISCORD_ID_2 = "discord_654321"

DISCORD_ID = "discord_123456"

FAKE_TOKEN = "FAKE_TOKEN"  # For unit test purpose

# User pagination
UNKNOWN_ROLE = "unknown"
ROLE = None
STATUS = None
PAGE = 1
SIZE = 10

# Game / Alliance
GAME_PSEUDO = "TestPlayer"
GAME_PSEUDO_2 = "TestPlayer2"
GAME_PSEUDO_3 = "TestPlayer3"
ALLIANCE_NAME = "TestAlliance"
ALLIANCE_TAG = "TEST"
