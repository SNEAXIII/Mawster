import { BACKEND, setupUser, type UserSetupData } from "../support/e2e";

describe("Alliances – UI", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Basic page rendering
  // =========================================================================

  it("shows the alliances page title", () => {
    setupUser("alliance-page-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.navTo("alliances");
      cy.contains("Alliances").should("be.visible");
      });
  });

  it("shows empty state when user has no game accounts", () => {
    setupUser("alliance-noacc-token").then(({ login }) => {
      cy.uiLogin(login);
      cy.navTo("alliances");
      cy.contains("Browse and create alliances for your alliance wars.").should("be.visible");
      cy.contains("No alliances yet. Create the first one!").should("be.visible");
    });
  });

  // =========================================================================
  // Alliance creation
  // =========================================================================

  it("creates an alliance via the UI form and verifies displayed content", () => {
    setupUser("alliance-create-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "AllianceLeader", true);

      cy.uiLogin(login);
      cy.navTo("alliances");

      cy.getByCy("alliance-name-input").should("be.visible").type("TestAlliance");
      cy.getByCy("alliance-tag-input").type("TA");
      cy.getByCy("alliance-create-btn").click();

      cy.contains("Alliance created successfully").should("be.visible");
      cy.getByCy("alliance-card-TestAlliance").should("be.visible");
      cy.getByCy("alliance-card-TestAlliance").within(() => {
        cy.getByCy("alliance-name").should("contain", "TestAlliance");
        cy.getByCy("alliance-tag").should("contain", "[TA]");
        cy.getByCy("alliance-officer-count").should("contain", "0 officers");
        cy.contains("AllianceLeader").should("be.visible");
      });
    });
  });

  // =========================================================================
  // Alliance members display
  // =========================================================================

  it("shows alliance members with correct roles after creation", () => {
    setupUser("alliance-members-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "LeaderAcc", true).then(
        (account) => {
          cy.apiCreateAlliance(access_token, "MyAlliance", "MA", account.id);
        }
      );

      cy.uiLogin(login);
      cy.navTo("alliances");

      cy.getByCy("alliance-card-MyAlliance").should("be.visible").within(() => {
        cy.getByCy("alliance-name").should("contain", "MyAlliance");
        cy.getByCy("alliance-tag").should("contain", "[MA]");
        cy.contains("Members").should("be.visible");
        cy.getByCy("member-row-LeaderAcc").should("be.visible");
        cy.getByCy("member-row-LeaderAcc").should("contain", "LeaderAcc");
      });
    });
  });

  // =========================================================================
  // Invitation flow: send, verify content, accept
  // =========================================================================

  it("invites a member and verifies pending invitation content", () => {
    let ownerData: UserSetupData;

    setupUser("alliance-owner-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "OwnerAcc", true);
    }).then((ownerAccount) => {
      return cy.apiCreateAlliance(
        ownerData.access_token,
        "InviteAlliance",
        "IA",
        ownerAccount.id
      );
    }).then(() => {
      return setupUser("alliance-newmember-token");
    }).then((newMember) => {
      return cy.apiCreateGameAccount(newMember.access_token, "NewMemberAcc", true);
    }).then(() => {
      cy.uiLogin(ownerData.login);
      cy.navTo("alliances");

      cy.getByCy("alliance-card-InviteAlliance").should("be.visible");

      cy.intercept("GET", "**/alliances/eligible-members").as("eligibleMembers");
      cy.getByCy("invite-member-toggle").click();
      cy.wait("@eligibleMembers");

      cy.getByCy("invite-member-select").click();
      cy.contains("[role='option']", "NewMemberAcc", { timeout: 1000 }).click();

      cy.getByCy("invite-member-submit").click({ timeout: 1000 });
      cy.contains("Invitation sent successfully").should("be.visible");

      // Verify pending invitation content
      cy.contains("Pending invitations (1)").should("be.visible");
      cy.getByCy("pending-invitation-0").should("contain", "NewMemberAcc");
      cy.getByCy("pending-invitation-0").should("contain", "Invited by OwnerAcc");
    });
  });

  it("accepts an invitation via the UI and verifies alliance content", () => {
    let ownerData: UserSetupData;
    let allianceId: string;
    let inviteeLogin: string;

    setupUser("alliance-accept-owner-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "AccOwner", true);
    }).then((ownerAccount) => {
      return cy.apiCreateAlliance(
        ownerData.access_token, "JoinAlliance", "JA", ownerAccount.id
      );
    }).then((alliance) => {
      allianceId = alliance.id;
      return setupUser("alliance-accept-invitee-token");
    }).then((invitee) => {
      inviteeLogin = invitee.login;
      return cy.apiCreateGameAccount(invitee.access_token, "JoinPlayer", true);
    }).then((inviteeAccount) => {
      cy.apiInviteMember(ownerData.access_token, allianceId, inviteeAccount.id);

      cy.uiLogin(inviteeLogin);
      cy.navTo("alliances");

      // Verify invitation content before accepting
      cy.getByCy("my-invitations-section").should("be.visible");
      cy.getByCy("my-invitation-JoinAlliance").should("contain", "JoinAlliance");
      cy.getByCy("my-invitation-JoinAlliance").should("contain", "[JA]");
      cy.getByCy("my-invitation-JoinAlliance").should("contain", "JoinPlayer");

      cy.getByCy("accept-invitation").click();
      cy.contains("Invitation accepted").should("be.visible");

      // After accepting, alliance card appears with correct member count
      cy.getByCy("alliance-card-JoinAlliance").should("be.visible").within(() => {
        cy.getByCy("alliance-member-count").should("contain", "2");
        cy.getByCy("member-row-JoinPlayer").should("be.visible");
        cy.getByCy("member-row-AccOwner").should("be.visible");
      });
    });
  });

  it("declines an invitation via the UI", () => {
    let ownerData: UserSetupData;
    let allianceId: string;
    let inviteeLogin: string;

    setupUser("alliance-decline-owner-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "DeclineOwner", true);
    }).then((ownerAccount) => {
      return cy.apiCreateAlliance(
        ownerData.access_token, "DeclineAlliance", "DA", ownerAccount.id
      );
    }).then((alliance) => {
      allianceId = alliance.id;
      return setupUser("alliance-decline-invitee-token");
    }).then((invitee) => {
      inviteeLogin = invitee.login;
      return cy.apiCreateGameAccount(invitee.access_token, "DeclinePlayer", true);
    }).then((inviteeAccount) => {
      cy.apiInviteMember(ownerData.access_token, allianceId, inviteeAccount.id);

      cy.uiLogin(inviteeLogin);
      cy.navTo("alliances");

      cy.getByCy("my-invitations-section").should("be.visible");
      cy.getByCy("decline-invitation").click();

      // After declining, invitations section disappears and no alliance card
      cy.getByCy("my-invitations-section").should("not.exist");
      cy.getByCy("alliance-empty-text").should("contain", "No alliances yet");
    });
  });

  // =========================================================================
  // Permissions: regular member restrictions
  // =========================================================================

  it("regular member cannot see invite button", () => {
    let ownerData: UserSetupData;
    let allianceId: string;
    let memberLogin: string;

    setupUser("perm-owner-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "PermOwner", true);
    }).then((ownerAccount) => {
      return cy.apiCreateAlliance(
        ownerData.access_token, "PermAlliance", "PA", ownerAccount.id
      );
    }).then((alliance) => {
      allianceId = alliance.id;
      return setupUser("perm-member-token");
    }).then((member) => {
      memberLogin = member.login;
      return cy.apiCreateGameAccount(member.access_token, "PermMember", true);
    }).then((memberAccount) => {
      cy.apiInviteMember(ownerData.access_token, allianceId, memberAccount.id);

      // Accept via API
      cy.request({
        method: "POST",
        url: `${BACKEND}/alliances/invitations/${memberAccount.id}/accept`,
        headers: { Authorization: `Bearer ${ownerData.access_token}` },
        failOnStatusCode: false,
      });

      // Accept via the invitee's session
      cy.request({
        method: "GET",
        url: `${BACKEND}/alliances/my-invitations`,
        headers: { Authorization: `Bearer ${ownerData.access_token}` },
        failOnStatusCode: false,
      });

      // Instead, login as member and accept through UI
      cy.uiLogin(memberLogin);
      cy.navTo("alliances");

      // Accept the invitation first
      cy.getByCy("accept-invitation").click();
      cy.contains("Invitation accepted").should("be.visible");

      // Now the member is in the alliance — verify no invite button
      cy.getByCy("alliance-card-PermAlliance").should("be.visible").within(() => {
        cy.getByCy("invite-member-toggle").should("not.exist");
        cy.getByCy("member-row-PermMember").should("be.visible");
        cy.getByCy("member-row-PermOwner").should("be.visible");
      });
    });
  });

  it("regular member cannot see pending invitations section", () => {
    let ownerData: UserSetupData;
    let allianceId: string;
    let memberLogin: string;

    setupUser("perm-pending-owner-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "PendingOwner", true);
    }).then((ownerAccount) => {
      return cy.apiCreateAlliance(
        ownerData.access_token, "PendingAlliance", "PD", ownerAccount.id
      );
    }).then((alliance) => {
      allianceId = alliance.id;
      return setupUser("perm-pending-member-token");
    }).then((member) => {
      memberLogin = member.login;
      return cy.apiCreateGameAccount(member.access_token, "PendingMember", true);
    }).then((memberAccount) => {
      // Add member via invitation + accept
      cy.apiInviteMember(ownerData.access_token, allianceId, memberAccount.id);

      cy.uiLogin(memberLogin);
      cy.navTo("alliances");
      cy.getByCy("accept-invitation").click();
      cy.contains("Invitation accepted").should("be.visible");

      // Now create another user and invite them (still pending)
      setupUser("perm-pending-third-token").then((third) => {
        cy.apiCreateGameAccount(third.access_token, "ThirdPlayer", true).then((thirdAccount) => {
          cy.apiInviteMember(ownerData.access_token, allianceId, thirdAccount.id);
        });
      });

      // Reload as regular member
      cy.visit("/game/alliances");
      cy.getByCy("alliance-card-PendingAlliance").should("be.visible").within(() => {
        // Regular member should NOT see the pending invitations section
        cy.contains("Pending invitations").should("not.exist");
      });
    });
  });

  it("regular member cannot see promote/demote/exclude buttons", () => {
    let ownerData: UserSetupData;
    let allianceId: string;
    let memberLogin: string;

    setupUser("perm-no-actions-owner-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "ActionsOwner", true);
    }).then((ownerAccount) => {
      return cy.apiCreateAlliance(
        ownerData.access_token, "ActionsAlliance", "AC", ownerAccount.id
      );
    }).then((alliance) => {
      allianceId = alliance.id;
      return setupUser("perm-no-actions-member-token");
    }).then((member) => {
      memberLogin = member.login;
      return cy.apiCreateGameAccount(member.access_token, "ActionsMember", true);
    }).then((memberAccount) => {
      cy.apiInviteMember(ownerData.access_token, allianceId, memberAccount.id);

      cy.uiLogin(memberLogin);
      cy.navTo("alliances");
      cy.getByCy("accept-invitation").click();
      cy.contains("Invitation accepted").should("be.visible");

      cy.visit("/game/alliances");
      cy.getByCy("alliance-card-ActionsAlliance").should("be.visible").within(() => {
        // Should not see promote/exclude buttons on owner row
        cy.getByCy("promote-officer-ActionsOwner").should("not.exist");
        cy.getByCy("exclude-member-ActionsOwner").should("not.exist");
        // Should not see group select (only officers/owners can)
        cy.getByCy("member-group-select").should("not.exist");
      });
    });
  });

  it("officer can see invite button but not promote button", () => {
    let ownerData: UserSetupData;
    let allianceId: string;
    let officerLogin: string;

    setupUser("perm-officer-owner-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "OfficerOwner", true);
    }).then((ownerAccount) => {
      return cy.apiCreateAlliance(
        ownerData.access_token, "OfficerAlliance", "OF", ownerAccount.id
      );
    }).then((alliance) => {
      allianceId = alliance.id;
      return setupUser("perm-officer-member-token");
    }).then((officer) => {
      officerLogin = officer.login;
      return cy.apiCreateGameAccount(officer.access_token, "OfficerMember", true);
    }).then((officerAccount) => {
      // Invite, accept, then promote to officer via API
      cy.apiInviteMember(ownerData.access_token, allianceId, officerAccount.id);

      cy.uiLogin(officerLogin);
      cy.navTo("alliances");
      cy.getByCy("accept-invitation").click();
      cy.contains("Invitation accepted").should("be.visible");

      // Promote to officer via API
      cy.apiAddOfficer(ownerData.access_token, allianceId, officerAccount.id);

      // Reload as officer
      cy.visit("/game/alliances");
      cy.getByCy("alliance-card-OfficerAlliance").should("be.visible").within(() => {
        // Officer CAN see invite button
        cy.getByCy("invite-member-toggle").should("be.visible");
        // Officer cannot see promote/demote buttons (only owner can)
        cy.getByCy("promote-officer-OfficerOwner").should("not.exist");
        cy.getByCy("demote-officer-OfficerOwner").should("not.exist");
        // Officer CAN see group selects
        cy.getByCy("member-group-select").should("exist");
      });
    });
  });

  // =========================================================================
  // Empty states
  // =========================================================================

  it("shows the empty state when user has game accounts but no alliances", () => {
    setupUser("alliance-empty-token").then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, "EmptyAcc", true);
      cy.uiLogin(login);
      cy.navTo("alliances");
      cy.getByCy("alliance-empty-text").should("contain", "No alliances yet");
    });
  });

  // =========================================================================
  // Edge cases — alliance name validation (3–50 chars)
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
  // Edge cases — alliance tag validation (1–5 chars)
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
  // Edge cases — ownership & auth
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
