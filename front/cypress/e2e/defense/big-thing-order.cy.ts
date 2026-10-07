import { putPlanNode, setupDefenseOwnerAndMember } from '../../support/e2e';

describe('Defense – Big Thing member order', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('sorts members by their first node instead of their role', () => {
    // By role ZuluOwner leads; by node, AlphaMember (node 1) must lead ZuluOwner (node 3).
    setupDefenseOwnerAndMember('def-bt-order', 'ZuluOwner', 'AlphaMember', 'BTOrderAll', 'BO').then(
      ({ adminData, ownerData, memberData, allianceId, ownerAccId, memberAccId }) => {
        const admin = adminData.access_token;
        const owner = ownerData.access_token;
        cy.apiCreatePlan(owner, allianceId, 1, 'BT plan', 'big_thing').then((plan) => {
          cy.apiGiveChampion(admin, memberData.access_token, memberAccId, 'Storm', 'Mutant').then(({ championUser }) =>
            putPlanNode(owner, allianceId, plan.id, 1, championUser.id),
          );
          cy.apiGiveChampion(admin, owner, ownerAccId, 'Spider-Man', 'Cosmic').then(({ championUser }) =>
            putPlanNode(owner, allianceId, plan.id, 3, championUser.id),
          );
        });

        cy.apiLogin(ownerData.user_id, 'defense');
        cy.getByCy('defense-format-big_thing').click();
        cy.get('[data-cy^="member-section-"]').should(($els) => {
          expect($els.toArray().map((el) => el.dataset.cy)).to.deep.equal([
            'member-section-AlphaMember',
            'member-section-ZuluOwner',
          ]);
        });
      },
    );
  });
});
