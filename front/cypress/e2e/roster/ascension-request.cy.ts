import { setupRosterUser } from '../../support/e2e';

const CHAMPION = 'AscRequestHero';
const REQUEST_ROWS = '[data-cy^="ascension-request-row"]';

const requestButton = () => cy.getByCy('ascension-request-button');

function setupRequesterOnRoster(prefix: string, pseudo: string) {
  return setupRosterUser(prefix, pseudo).then((setup) => {
    cy.apiLoadChampion(setup.adminData.access_token, CHAMPION, 'Mutant');
    cy.apiLogin(setup.userData.user_id, 'roster');
    return cy.wrap(setup);
  });
}

function selectChampionInAddForm() {
  cy.getByCy('collapsible-add-update-a-champion').click();
  cy.getByCy('champion-search').type(CHAMPION);
}

function requestAscension() {
  selectChampionInAddForm();
  requestButton().should('have.attr', 'data-requested', 'false');
  requestButton().click();
  requestButton().should('have.attr', 'data-requested', 'true');
}

function openAdminWithPendingRequest(adminId: string, requesterLogin: string) {
  cy.apiLogin(adminId, '/admin?tab=champions');
  cy.get(REQUEST_ROWS).should(($rows) => {
    expect($rows).to.have.length(1);
    expect($rows.text()).to.contain(CHAMPION);
    expect($rows.text()).to.contain(requesterLogin);
  });
  cy.getByCy('tab-champions').should('contain.text', '(1)');
}

function assertNoPendingRequest() {
  cy.get(REQUEST_ROWS).should('not.exist');
  cy.getByCy('tab-champions').should('not.contain.text', '(');
}

describe('Roster – Ascension Request', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('keeps a request made from the add form after a reload', () => {
    setupRequesterOnRoster('ui-ascreq-form', 'AscReqForm').then(() => {
      requestAscension();

      cy.reload();
      selectChampionInAddForm();
      requestButton().should('have.attr', 'data-requested', 'true');
    });
  });

  it('lets an admin accept a pending request', () => {
    setupRequesterOnRoster('ui-ascreq-accept', 'AscReqAccept').then(({ adminData, userData }) => {
      requestAscension();
      openAdminWithPendingRequest(adminData.user_id, userData.login);

      cy.getByCy('ascension-request-accept').click();
      assertNoPendingRequest();
    });
  });

  it('lets an admin refuse a request, after which the user can request again', () => {
    setupRequesterOnRoster('ui-ascreq-refuse', 'AscReqRefuse').then(({ adminData, userData }) => {
      requestAscension();
      openAdminWithPendingRequest(adminData.user_id, userData.login);

      cy.getByCy('ascension-request-refuse').click();
      assertNoPendingRequest();

      cy.apiLogin(userData.user_id, 'roster');
      requestAscension();
    });
  });
});
