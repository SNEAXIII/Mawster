import { setupUser, setupAdmin, type UserSetupData, BACKEND } from "../../support/e2e";

describe("Roster – Champion Upgrade", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Basic upgrade via API
  // =========================================================================

  it("upgrades a champion one rank via API and UI reflects it", () => {
    setupAdmin("upg-basic-admin").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "Hercules", "Cosmic").then((champs) => {
        setupUser("upg-basic-user").then(({ login, access_token }) => {
          cy.apiCreateGameAccount(access_token, "HercPlayer", true).then((acc) => {
            cy.apiAddChampionToRoster(access_token, acc.id, champs[0].id, "7r1").then((cu) => {
              // Upgrade 7r1 → 7r2
              cy.apiUpgradeChampion(access_token, cu.id);

              cy.uiLogin(login);
              cy.navTo("roster");
              cy.contains("Hercules").should("be.visible");
            });
          });
        });
      });
    });
  });

  it("upgrade button is visible on a champion that is not at max rank", () => {
    setupAdmin("upg-btn-admin").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "DoctorDoom", "Mystic").then((champs) => {
        setupUser("upg-btn-user").then(({ login, access_token }) => {
          cy.apiCreateGameAccount(access_token, "DoomPlayer", true).then((acc) => {
            cy.apiAddChampionToRoster(access_token, acc.id, champs[0].id, "7r2");

            cy.uiLogin(login);
            cy.navTo("roster");
            cy.getByCy("champion-upgrade").should("exist");
          });
        });
      });
    });
  });

  it("upgrade button is NOT visible on a champion at max rank (7r5)", () => {
    setupAdmin("upg-max-admin").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "MaxRankHero", "Tech").then((champs) => {
        setupUser("upg-max-user").then(({ login, access_token }) => {
          cy.apiCreateGameAccount(access_token, "MaxPlayer", true).then((acc) => {
            cy.apiAddChampionToRoster(access_token, acc.id, champs[0].id, "7r5");

            cy.uiLogin(login);
            cy.navTo("roster");
            cy.getByCy("champion-upgrade").should("not.exist");
          });
        });
      });
    });
  });

  it("cannot upgrade past max rank via API", () => {
    setupAdmin("upg-past-admin").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "MaxPastHero", "Skill").then((champs) => {
        setupUser("upg-past-user").then(({ access_token }) => {
          cy.apiCreateGameAccount(access_token, "MaxPastPlayer", true).then((acc) => {
            cy.apiAddChampionToRoster(access_token, acc.id, champs[0].id, "7r5").then((cu) => {
              cy.request({
                method: "PATCH",
                url: `${BACKEND}/champion-users/${cu.id}/upgrade`,
                headers: { Authorization: `Bearer ${access_token}` },
                failOnStatusCode: false,
              }).then((res) => {
                expect(res.status).to.be.oneOf([400, 422]);
              });
            });
          });
        });
      });
    });
  });

  // =========================================================================
  // Multiple sequential upgrades
  // =========================================================================

  it("can upgrade champion through multiple ranks sequentially", () => {
    setupAdmin("upg-multi-admin").then((admin) => {
      cy.apiLoadChampion(admin.access_token, "MultUpHero", "Mutant").then((champs) => {
        setupUser("upg-multi-user").then(({ login, access_token }) => {
          cy.apiCreateGameAccount(access_token, "MultUpPlayer", true).then((acc) => {
            cy.apiAddChampionToRoster(access_token, acc.id, champs[0].id, "7r1").then((cu) => {
              // Upgrade 7r1 → 7r2 → 7r3 → 7r4
              cy.apiUpgradeChampion(access_token, cu.id);
              cy.apiUpgradeChampion(access_token, cu.id);
              cy.apiUpgradeChampion(access_token, cu.id);

              cy.uiLogin(login);
              cy.navTo("roster");
              cy.contains("MultUpHero").should("be.visible");
            });
          });
        });
      });
    });
  });
});

describe("Roster – Upgrade Requests", () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  /**
   * Helper: create an alliance with an owner and a member using force-join.
   * Also loads a champion and adds it to the member's roster at 7r1.
   */
  function setupAllianceWithMember(
    adminToken: string,
    championName: string,
    championClass: string,
  ) {
    let ownerData: UserSetupData;
    let memberData: UserSetupData;
    let allianceId: string;
    let memberAccId: string;
    let champId: string;

    return setupUser("ur-owner-token").then((owner) => {
      ownerData = owner;
      return cy.apiCreateGameAccount(owner.access_token, "UROwner", true);
    }).then((ownerAcc) => {
      return cy.apiCreateAlliance(ownerData.access_token, "URAlliance", "UR", ownerAcc.id);
    }).then((alliance) => {
      allianceId = alliance.id;
      return setupUser("ur-member-token");
    }).then((member) => {
      memberData = member;
      return cy.apiCreateGameAccount(member.access_token, "URMember", true);
    }).then((memberAcc) => {
      memberAccId = memberAcc.id;
      // Force-join instead of invite + accept through UI
      cy.apiForceJoinAlliance(memberAccId, allianceId);
      return cy.apiLoadChampion(adminToken, championName, championClass);
    }).then((champs) => {
      champId = champs[0].id;
      return cy.apiAddChampionToRoster(memberData.access_token, memberAccId, champId, "7r1").then((cu) => ({
        ownerData,
        memberData,
        allianceId,
        memberAccId,
        champId,
        championUserId: cu.id as string,
      }));
    });
  }

  // ── 1. Officer creates upgrade request via roster preview ──────────────────

  it("officer can request an upgrade for a member in the roster preview", () => {
    setupAdmin("ur-t1-admin").then((admin) => {
      setupAllianceWithMember(admin.access_token, "Spider-Man", "Science").then(
        ({ ownerData }) => {
          cy.uiLogin(ownerData.login);
          cy.navTo("alliances");

          // Wait for alliance roles to load before opening roster dialog
          cy.getByCy("invite-member-toggle").should("be.visible");
          cy.getByCy("view-roster-URMember").click();

          // Click the upgrade button on the first champion card
          cy.getByCy("champion-upgrade").first().click({ force: true });

          // Select 7r3 in the rarity dropdown
          cy.getByCy("upgrade-rarity-select").click();
          cy.contains("[role='option']", "7★R3").click();

          // Confirm
          cy.getByCy("request-upgrade-btn").click();

          // The upgrade requests section should now be visible in the dialog
          cy.getByCy("upgrade-requests-section").should("be.visible");
          // Expand the collapsible (defaultOpen=false)
          cy.getByCy("upgrade-requests-section").click();
          cy.getByCy("upgrade-request-item").should("have.length", 1);
        }
      );
    });
  });

  // ── 2. Member can see their own pending requests ───────────────────────────

  it("member can see their pending upgrade requests on their roster page", () => {
    setupAdmin("ur-t2-admin").then((admin) => {
      setupAllianceWithMember(admin.access_token, "Wolverine", "Mutant").then(
        ({ ownerData, memberData, championUserId }) => {
          cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, "7r3");

          cy.uiLogin(memberData.login);
          cy.navTo("roster");

          // The section is collapsed by default, need to expand it
          cy.getByCy("upgrade-requests-section").should("be.visible");
          cy.getByCy("upgrade-requests-section").click();
          cy.getByCy("upgrade-request-item").should("have.length", 1);
          cy.contains("Wolverine").should("be.visible");
        }
      );
    });
  });

  // ── 3. Request auto-completes when champion reaches target rarity ──────────

  it("upgrade request disappears when champion reaches the target rarity", () => {
    setupAdmin("ur-t3-admin").then((admin) => {
      setupAllianceWithMember(admin.access_token, "Iron Man", "Tech").then(
        ({ ownerData, memberData, championUserId }) => {
          cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, "7r3");

          // Verify the request is visible on the member's roster page
          cy.uiLogin(memberData.login);
          cy.navTo("roster");
          cy.getByCy("upgrade-requests-section").should("be.visible");

          // Upgrade champion 7r1 → 7r2 → 7r3 via API
          cy.apiUpgradeChampion(memberData.access_token, championUserId);
          cy.apiUpgradeChampion(memberData.access_token, championUserId);

          // Reload the page – the request should be gone (completed)
          cy.reload();
          cy.getByCy("upgrade-requests-section").should("not.exist");
        }
      );
    });
  });

  // ── 3b. Request stays when champion is upgraded but not to target ──────────

  it("upgrade request stays when champion is upgraded but not to the target rarity", () => {
    setupAdmin("ur-t3b-admin").then((admin) => {
      setupAllianceWithMember(admin.access_token, "Magneto", "Mutant").then(
        ({ ownerData, memberData, championUserId }) => {
          // Request 7r4 but champion is at 7r1
          cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, "7r4");

          cy.uiLogin(memberData.login);
          cy.navTo("roster");
          cy.getByCy("upgrade-requests-section").should("be.visible");

          // Upgrade 7r1 → 7r2 (still below 7r4)
          cy.apiUpgradeChampion(memberData.access_token, championUserId);

          cy.reload();
          // Request should still be visible because champion is at 7r2, not 7r4
          cy.getByCy("upgrade-requests-section").should("be.visible");
        }
      );
    });
  });

  // ── 3c. Request completes when champion is upgraded past target rarity ────

  it("upgrade request completes when champion is upgraded past the target rarity", () => {
    setupAdmin("ur-t3c-admin").then((admin) => {
      setupAllianceWithMember(admin.access_token, "Cyclops", "Mutant").then(
        ({ ownerData, memberData, championUserId }) => {
          // Request 7r2 but champion is at 7r1
          cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, "7r2");

          cy.uiLogin(memberData.login);
          cy.navTo("roster");
          cy.getByCy("upgrade-requests-section").should("be.visible");

          // Upgrade 7r1 → 7r2 → 7r3 (past target)
          cy.apiUpgradeChampion(memberData.access_token, championUserId);
          cy.apiUpgradeChampion(memberData.access_token, championUserId);

          cy.reload();
          // Request should be gone since champion rarity >= target rarity
          cy.getByCy("upgrade-requests-section").should("not.exist");
        }
      );
    });
  });

  // ── 4. Officer can cancel a member's upgrade request ──────────────────────

  it("officer can cancel a member's upgrade request in the roster preview", () => {
    setupAdmin("ur-t4-admin").then((admin) => {
      setupAllianceWithMember(admin.access_token, "Thor", "Cosmic").then(
        ({ ownerData, championUserId }) => {
          cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, "7r3");

          cy.uiLogin(ownerData.login);
          cy.navTo("alliances");

          // Wait for alliance roles to load before opening roster dialog
          cy.getByCy("invite-member-toggle").should("be.visible");
          cy.getByCy("view-roster-URMember").click();

          cy.getByCy("upgrade-requests-section").should("be.visible");
          // Expand the collapsible section (defaultOpen=false)
          cy.getByCy("upgrade-requests-section").click();
          cy.getByCy("cancel-upgrade-request").first().click();

          // Confirm in the dialog ("Cancel request" is the action button)
          cy.get('[role="alertdialog"]').contains("button", "Cancel request").click();

          cy.getByCy("upgrade-requests-section").should("not.exist");
        }
      );
    });
  });

  // ── 5. Officer can cancel an upgrade request on their own roster ───────────

  it("officer can cancel an upgrade request on their own roster", () => {
    setupAdmin("ur-t5-admin").then((admin) => {
      let ownerData: UserSetupData;
      let ownerAccId: string;

      setupUser("ur-t5-owner").then((owner) => {
        ownerData = owner;
        return cy.apiCreateGameAccount(owner.access_token, "T5Owner", true);
      }).then((ownerAcc) => {
        ownerAccId = ownerAcc.id;
        return cy.apiCreateAlliance(ownerData.access_token, "T5Alliance", "T5", ownerAccId);
      }).then(() => {
        return cy.apiLoadChampion(admin.access_token, "Captain America", "Science");
      }).then((champs) => {
        return cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, "7r1");
      }).then((cu) => {
        // Owner creates a request on their own champion
        cy.apiCreateUpgradeRequest(ownerData.access_token, cu.id, "7r3");

        cy.uiLogin(ownerData.login);
        cy.navTo("roster");

        cy.getByCy("upgrade-requests-section").should("be.visible");
        // Expand the collapsible
        cy.getByCy("upgrade-requests-section").click();
        // The cancel button must be visible (owner has can_manage = true)
        cy.getByCy("cancel-upgrade-request").should("be.visible");
        cy.getByCy("cancel-upgrade-request").first().click();

        // Confirm in the dialog ("Cancel request" is the action button)
        cy.get('[role="alertdialog"]').contains("button", "Cancel request").click();

        cy.getByCy("upgrade-requests-section").should("not.exist");
      });
    });
  });

  // ── 6. Regular member: no cancel button in another member's roster preview ─

  it("regular member cannot cancel upgrade requests in another member's roster preview", () => {
    setupAdmin("ur-t6-admin").then((admin) => {
      let ownerData: UserSetupData;
      let member1Login: string;
      let allianceId: string;
      let memberAccId: string;

      setupUser("ur-t6-owner").then((owner) => {
        ownerData = owner;
        return cy.apiCreateGameAccount(owner.access_token, "T6Owner", true);
      }).then((ownerAcc) => {
        return cy.apiCreateAlliance(ownerData.access_token, "T6Alliance", "T6", ownerAcc.id);
      }).then((alliance) => {
        allianceId = alliance.id;
        return setupUser("ur-t6-member2");
      }).then((m2) => {
        return cy.apiCreateGameAccount(m2.access_token, "T6Member2", true).then((acc) => {
          memberAccId = acc.id;
          // Force-join member2 instead of invite+accept
          cy.apiForceJoinAlliance(acc.id, allianceId);
          return cy.apiLoadChampion(admin.access_token, "Black Widow", "Skill");
        }).then((champs) => {
          return cy.apiAddChampionToRoster(m2.access_token, memberAccId, champs[0].id, "7r1");
        }).then((cu) => {
          cy.apiCreateUpgradeRequest(ownerData.access_token, cu.id, "7r3");
          return setupUser("ur-t6-member1");
        }).then((m1) => {
          member1Login = m1.login;
          return cy.apiCreateGameAccount(m1.access_token, "T6Member1", true);
        }).then((m1Acc) => {
          // Force-join member1 instead of invite+accept
          cy.apiForceJoinAlliance(m1Acc.id, allianceId);
          cy.uiLogin(member1Login);
          cy.navTo("alliances");

          // Regular member1 views member2's roster
          cy.getByCy("view-roster-T6Member2").click();

          // The upgrade requests section is NOT shown for regular members
          cy.getByCy("upgrade-requests-section").should("not.exist");
        });
      });
    });
  });

  // ── 7. Regular member: no cancel button on own roster page ────────────────

  it("regular member cannot cancel upgrade requests on their own roster", () => {
    setupAdmin("ur-t7-admin").then((admin) => {
      setupAllianceWithMember(admin.access_token, "Deadpool", "Mutant").then(
        ({ ownerData, memberData, championUserId }) => {
          cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, "7r3");

          cy.uiLogin(memberData.login);
          cy.navTo("roster");

          // The section IS visible (member can see their requests)
          cy.getByCy("upgrade-requests-section").should("be.visible");
          // Expand the collapsible
          cy.getByCy("upgrade-requests-section").click();
          // But the cancel button is NOT shown (member has can_manage = false)
          cy.getByCy("cancel-upgrade-request").should("not.exist");
        }
      );
    });
  });

  // ── 8. Multiple upgrade requests show correct count ────────────────────────

  it("shows correct count for multiple upgrade requests", () => {
    setupAdmin("ur-t8-admin").then((admin) => {
      let ownerData: UserSetupData;
      let memberData: UserSetupData;
      let allianceId: string;
      let memberAccId: string;

      setupUser("ur-t8-owner").then((owner) => {
        ownerData = owner;
        return cy.apiCreateGameAccount(owner.access_token, "T8Owner", true);
      }).then((ownerAcc) => {
        return cy.apiCreateAlliance(ownerData.access_token, "T8Alliance", "T8", ownerAcc.id);
      }).then((alliance) => {
        allianceId = alliance.id;
        return setupUser("ur-t8-member");
      }).then((member) => {
        memberData = member;
        return cy.apiCreateGameAccount(member.access_token, "T8Member", true);
      }).then((memberAcc) => {
        memberAccId = memberAcc.id;
        cy.apiForceJoinAlliance(memberAccId, allianceId);
        return cy.apiLoadChampion(admin.access_token, "HulkMulti", "Science");
      }).then((c1) => {
        return cy.apiAddChampionToRoster(memberData.access_token, memberAccId, c1[0].id, "7r1").then((cu1) => {
          cy.apiCreateUpgradeRequest(ownerData.access_token, cu1.id, "7r3");
          return cy.apiLoadChampion(admin.access_token, "ThanosMulti", "Cosmic");
        }).then((c2) => {
          return cy.apiAddChampionToRoster(memberData.access_token, memberAccId, c2[0].id, "7r1");
        }).then((cu2) => {
          cy.apiCreateUpgradeRequest(ownerData.access_token, cu2.id, "7r4");

          cy.uiLogin(memberData.login);
          cy.navTo("roster");

          cy.getByCy("upgrade-requests-section").should("be.visible");
          // Expand
          cy.getByCy("upgrade-requests-section").click();
          cy.getByCy("upgrade-request-item").should("have.length", 2);
        });
      });
    });
  });

  // ── 9. Cancel on champion card cancels the pending request ─────────────────

  it("cancel button on champion card cancels the pending request (alliance dialog)", () => {
    setupAdmin("ur-t9-admin").then((admin) => {
      setupAllianceWithMember(admin.access_token, "SentryCard", "Science").then(
        ({ ownerData, championUserId }) => {
          cy.apiCreateUpgradeRequest(ownerData.access_token, championUserId, "7r3");

          cy.uiLogin(ownerData.login);
          cy.navTo("alliances");

          // Wait for alliance roles to load
          cy.getByCy("invite-member-toggle").should("be.visible");
          cy.getByCy("view-roster-URMember").click();

          // The cancel-pending-request button is on the champion card in the dialog
          cy.getByCy("cancel-pending-request").should("exist");
          cy.getByCy("cancel-pending-request").first().click({ force: true });

          // Confirm in the cancel confirmation dialog
          cy.get('[role="alertdialog"]').contains("button", "Cancel request").click();

          // After cancelling the only request, the upgrade-requests-section should disappear
          // and the pending request button should be gone
          cy.getByCy("cancel-pending-request").should("not.exist");
          cy.getByCy("upgrade-requests-section").should("not.exist");
        }
      );
    });
  });
});
