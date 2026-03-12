import { BACKEND, setupUser } from "../../support/e2e";

describe("Alliances – Edge Cases", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Alliance name validation (3–50 chars)
  // =========================================================================

  it("rejects alliance name shorter than 3 chars (API)", () => {
    setupUser("ally-short-name-token").then(({ access_token }) => {
      cy.apiCreateGameAccount(access_token, "ShortNameAcc", true).then((acc) => {
        cy.request({
          method: "POST",
          url: `${BACKEND}/alliances`,
          headers: { Authorization: `Bearer ${access_token}` },
          body: { name: "AB", tag: "OK", owner_id: acc.id },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.eq(422);
        });
      });
    });
  });

  it("accepts alliance name of exactly 3 chars (API)", () => {
    setupUser("ally-min3-name-token").then(({ access_token }) => {
      cy.apiCreateGameAccount(access_token, "Min3NameAcc", true).then((acc) => {
        cy.request({
          method: "POST",
          url: `${BACKEND}/alliances`,
          headers: { Authorization: `Bearer ${access_token}` },
          body: { name: "ABC", tag: "OK", owner_id: acc.id },
        }).then((res) => {
          expect(res.status).to.eq(201);
          expect(res.body.name).to.eq("ABC");
        });
      });
    });
  });

  it("accepts alliance name of exactly 50 chars (API)", () => {
    setupUser("ally-max50-name-token").then(({ access_token }) => {
      cy.apiCreateGameAccount(access_token, "Max50NameAcc", true).then((acc) => {
        const name50 = "N".repeat(50);
        cy.request({
          method: "POST",
          url: `${BACKEND}/alliances`,
          headers: { Authorization: `Bearer ${access_token}` },
          body: { name: name50, tag: "OK", owner_id: acc.id },
        }).then((res) => {
          expect(res.status).to.eq(201);
          expect(res.body.name).to.eq(name50);
        });
      });
    });
  });

  it("rejects alliance name longer than 50 chars (API)", () => {
    setupUser("ally-long-name-token").then(({ access_token }) => {
      cy.apiCreateGameAccount(access_token, "LongNameAcc", true).then((acc) => {
        const name51 = "N".repeat(51);
        cy.request({
          method: "POST",
          url: `${BACKEND}/alliances`,
          headers: { Authorization: `Bearer ${access_token}` },
          body: { name: name51, tag: "OK", owner_id: acc.id },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.eq(422);
        });
      });
    });
  });

  it("rejects empty alliance name (API)", () => {
    setupUser("ally-empty-name-token").then(({ access_token }) => {
      cy.apiCreateGameAccount(access_token, "EmptyNameAcc", true).then((acc) => {
        cy.request({
          method: "POST",
          url: `${BACKEND}/alliances`,
          headers: { Authorization: `Bearer ${access_token}` },
          body: { name: "", tag: "OK", owner_id: acc.id },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.eq(422);
        });
      });
    });
  });

  // =========================================================================
  // Alliance tag validation (1–5 chars)
  // =========================================================================

  it("rejects empty alliance tag (API)", () => {
    setupUser("ally-empty-tag-token").then(({ access_token }) => {
      cy.apiCreateGameAccount(access_token, "EmptyTagAcc", true).then((acc) => {
        cy.request({
          method: "POST",
          url: `${BACKEND}/alliances`,
          headers: { Authorization: `Bearer ${access_token}` },
          body: { name: "ValidName", tag: "", owner_id: acc.id },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.eq(422);
        });
      });
    });
  });

  it("accepts alliance tag of exactly 1 char (API)", () => {
    setupUser("ally-min1-tag-token").then(({ access_token }) => {
      cy.apiCreateGameAccount(access_token, "Min1TagAcc", true).then((acc) => {
        cy.request({
          method: "POST",
          url: `${BACKEND}/alliances`,
          headers: { Authorization: `Bearer ${access_token}` },
          body: { name: "OneCharTag", tag: "X", owner_id: acc.id },
        }).then((res) => {
          expect(res.status).to.eq(201);
          expect(res.body.tag).to.eq("X");
        });
      });
    });
  });

  it("accepts alliance tag of exactly 5 chars (API)", () => {
    setupUser("ally-max5-tag-token").then(({ access_token }) => {
      cy.apiCreateGameAccount(access_token, "Max5TagAcc", true).then((acc) => {
        cy.request({
          method: "POST",
          url: `${BACKEND}/alliances`,
          headers: { Authorization: `Bearer ${access_token}` },
          body: { name: "FiveCharTag", tag: "ABCDE", owner_id: acc.id },
        }).then((res) => {
          expect(res.status).to.eq(201);
          expect(res.body.tag).to.eq("ABCDE");
        });
      });
    });
  });

  it("rejects alliance tag longer than 5 chars (API)", () => {
    setupUser("ally-long-tag-token").then(({ access_token }) => {
      cy.apiCreateGameAccount(access_token, "LongTagAcc", true).then((acc) => {
        cy.request({
          method: "POST",
          url: `${BACKEND}/alliances`,
          headers: { Authorization: `Bearer ${access_token}` },
          body: { name: "ValidName", tag: "ABCDEF", owner_id: acc.id },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.eq(422);
        });
      });
    });
  });

  // =========================================================================
  // Ownership & auth edge cases
  // =========================================================================

  it("returns 401 creating alliance without auth", () => {
    cy.request({
      method: "POST",
      url: `${BACKEND}/alliances`,
      body: { name: "NoAuth", tag: "NA", owner_id: "00000000-0000-0000-0000-000000000000" },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(401);
    });
  });

  it("returns 403 when owner_id belongs to another user", () => {
    setupUser("ally-stolen-owner-token").then(({ access_token }) => {
      cy.apiCreateGameAccount(access_token, "RealOwner", true).then((acc) => {
        setupUser("ally-stolen-thief-token").then(({ access_token: thiefToken }) => {
          cy.request({
            method: "POST",
            url: `${BACKEND}/alliances`,
            headers: { Authorization: `Bearer ${thiefToken}` },
            body: { name: "StolenAlliance", tag: "STEAL", owner_id: acc.id },
            failOnStatusCode: false,
          }).then((res) => {
            expect(res.status).to.eq(403);
          });
        });
      });
    });
  });

  it("returns 404 when owner_id does not exist", () => {
    setupUser("ally-fake-owner-token").then(({ access_token }) => {
      cy.request({
        method: "POST",
        url: `${BACKEND}/alliances`,
        headers: { Authorization: `Bearer ${access_token}` },
        body: { name: "NoOwner", tag: "FAKE", owner_id: "00000000-0000-0000-0000-000000000000" },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(404);
      });
    });
  });

  it("returns 409 when owner is already in an alliance", () => {
    setupUser("ally-double-token").then(({ access_token }) => {
      cy.apiCreateGameAccount(access_token, "DoubleOwner", true).then((acc) => {
        cy.apiCreateAlliance(access_token, "First", "F1", acc.id);

        cy.request({
          method: "POST",
          url: `${BACKEND}/alliances`,
          headers: { Authorization: `Bearer ${access_token}` },
          body: { name: "Second", tag: "S2", owner_id: acc.id },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.eq(409);
        });
      });
    });
  });

  it("returns 404 when getting a non-existent alliance", () => {
    setupUser("ally-get404-token").then(({ access_token }) => {
      cy.request({
        method: "GET",
        url: `${BACKEND}/alliances/00000000-0000-0000-0000-000000000000`,
        headers: { Authorization: `Bearer ${access_token}` },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(404);
      });
    });
  });
});
