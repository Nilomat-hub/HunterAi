import assert from "node:assert/strict";
import test from "node:test";
import { validateDirectImmobilie1SendInput } from "../lib/actions/application-safety";

test("blocks direct Immobilie1 sending when required contact data is missing", () => {
  const result = validateDirectImmobilie1SendInput({
    firstName: "Nils",
    lastName: "",
    contactEmail: "",
    loginEmail: "nils@example.com",
    salutation: "",
    message: "Hallo, ich interessiere mich fuer die Wohnung und freue mich auf Rueckmeldung."
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.reasons, ["Vollstaendiger Name fehlt.", "Kontakt-E-Mail fehlt.", "Anrede fehlt."]);
});

test("returns explicit values for a valid direct Immobilie1 send", () => {
  const result = validateDirectImmobilie1SendInput({
    firstName: "Nils",
    lastName: "Voigt",
    contactEmail: "kontakt@example.com",
    loginEmail: "login@example.com",
    salutation: "Herr",
    message: "Hallo, ich interessiere mich fuer die Wohnung und freue mich auf Rueckmeldung."
  });

  assert.deepEqual(result, {
    ok: true,
    values: {
      fullName: "Nils Voigt",
      contactEmail: "kontakt@example.com",
      salutation: "Herr",
      message: "Hallo, ich interessiere mich fuer die Wohnung und freue mich auf Rueckmeldung."
    }
  });
});
