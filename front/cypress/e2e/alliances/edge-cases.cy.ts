import { BACKEND, setupUser, UserSetupData } from '../../support/e2e';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** user + primary game account, the setup every creation test needs. */
function setupOwner(
  discordToken: string,
  pseudo: string,
): Cypress.Chainable<{ userData: UserSetupData; accountId: string }> {
  return setupUser(discordToken).then((userData) =>
    cy.apiCreateGameAccount(userData.access_token, pseudo, true).then((acc) => ({ userData, accountId: acc.id })),
  );
}

/** POST /alliances without throwing, so each test asserts the status itself. */
function createAllianceRequest(token: string | null, body: Record<string, unknown>) {
  return cy.request({
    method: 'POST',
    url: `${BACKEND}/alliances`,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body,
    failOnStatusCode: false,
  });
}

interface ValidationCase {
  title: string;
  discordToken: string;
  pseudo: string;
  name: string;
  tag: string;
  status: number;
}

const NAME_CASES: ValidationCase[] = [
  {
    title: 'rejects alliance name shorter than 3 chars (API)',
    discordToken: 'ally-short-name-token',
    pseudo: 'ShortNameAcc',
    name: 'AB',
    tag: 'OK',
    status: 422,
  },
  {
    title: 'accepts alliance name of exactly 3 chars (API)',
    discordToken: 'ally-min3-name-token',
    pseudo: 'Min3NameAcc',
    name: 'ABC',
    tag: 'OK',
    status: 201,
  },
  {
    title: 'accepts alliance name of exactly 50 chars (API)',
    discordToken: 'ally-max50-name-token',
    pseudo: 'Max50NameAcc',
    name: 'N'.repeat(50),
    tag: 'OK',
    status: 201,
  },
  {
    title: 'rejects alliance name longer than 50 chars (API)',
    discordToken: 'ally-long-name-token',
    pseudo: 'LongNameAcc',
    name: 'N'.repeat(51),
    tag: 'OK',
    status: 422,
  },
  {
    title: 'rejects empty alliance name (API)',
    discordToken: 'ally-empty-name-token',
    pseudo: 'EmptyNameAcc',
    name: '',
    tag: 'OK',
    status: 422,
  },
];

const TAG_CASES: ValidationCase[] = [
  {
    title: 'rejects empty alliance tag (API)',
    discordToken: 'ally-empty-tag-token',
    pseudo: 'EmptyTagAcc',
    name: 'ValidName',
    tag: '',
    status: 422,
  },
  {
    title: 'accepts alliance tag of exactly 1 char (API)',
    discordToken: 'ally-min1-tag-token',
    pseudo: 'Min1TagAcc',
    name: 'OneCharTag',
    tag: 'X',
    status: 201,
  },
  {
    title: 'accepts alliance tag of exactly 5 chars (API)',
    discordToken: 'ally-max5-tag-token',
    pseudo: 'Max5TagAcc',
    name: 'FiveCharTag',
    tag: 'ABCDE',
    status: 201,
  },
  {
    title: 'rejects alliance tag longer than 5 chars (API)',
    discordToken: 'ally-long-tag-token',
    pseudo: 'LongTagAcc',
    name: 'ValidName',
    tag: 'ABCDEF',
    status: 422,
  },
];

function runValidationCase({ discordToken, pseudo, name, tag, status }: ValidationCase) {
  setupOwner(discordToken, pseudo).then(({ userData, accountId }) => {
    createAllianceRequest(userData.access_token, { name, tag, owner_id: accountId }).then((res) => {
      expect(res.status).to.eq(status);
      if (status === 201) {
        expect(res.body.name).to.eq(name);
        expect(res.body.tag).to.eq(tag);
      }
    });
  });
}

describe('Alliances – Edge Cases', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Alliance name validation (3–50 chars)
  // =========================================================================

  NAME_CASES.forEach((testCase) => {
    it(testCase.title, () => runValidationCase(testCase));
  });

  // =========================================================================
  // Alliance tag validation (1–5 chars)
  // =========================================================================

  TAG_CASES.forEach((testCase) => {
    it(testCase.title, () => runValidationCase(testCase));
  });

  // =========================================================================
  // Ownership & auth edge cases
  // =========================================================================

  it('returns 401 creating alliance without auth', () => {
    createAllianceRequest(null, { name: 'NoAuth', tag: 'NA', owner_id: NIL_UUID }).then((res) => {
      expect(res.status).to.eq(401);
    });
  });

  it('returns 403 when owner_id belongs to another user', () => {
    setupOwner('ally-stolen-owner-token', 'RealOwner').then(({ accountId }) => {
      setupUser('ally-stolen-thief-token').then(({ access_token: thiefToken }) => {
        createAllianceRequest(thiefToken, { name: 'StolenAlliance', tag: 'STEAL', owner_id: accountId }).then((res) => {
          expect(res.status).to.eq(403);
        });
      });
    });
  });

  it('returns 404 when owner_id does not exist', () => {
    setupUser('ally-fake-owner-token').then(({ access_token }) => {
      createAllianceRequest(access_token, { name: 'NoOwner', tag: 'FAKE', owner_id: NIL_UUID }).then((res) => {
        expect(res.status).to.eq(404);
      });
    });
  });

  it('returns 409 when owner is already in an alliance', () => {
    setupOwner('ally-double-token', 'DoubleOwner').then(({ userData, accountId }) => {
      cy.apiCreateAlliance(userData.access_token, 'First', 'F1', accountId);

      createAllianceRequest(userData.access_token, { name: 'Second', tag: 'S2', owner_id: accountId }).then((res) => {
        expect(res.status).to.eq(409);
      });
    });
  });

  it('returns 404 when getting a non-existent alliance', () => {
    setupUser('ally-get404-token').then(({ access_token }) => {
      cy.request({
        method: 'GET',
        url: `${BACKEND}/alliances/${NIL_UUID}`,
        headers: { Authorization: `Bearer ${access_token}` },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(404);
      });
    });
  });
});
