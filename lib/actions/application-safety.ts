type DirectImmobilie1SendInput = {
  firstName?: string | null;
  lastName?: string | null;
  contactEmail?: string | null;
  loginEmail?: string | null;
  salutation?: string | null;
  message?: string | null;
};

type DirectImmobilie1SendValidation =
  | {
      ok: true;
      values: {
        fullName: string;
        contactEmail: string;
        salutation: string;
        message: string;
      };
    }
  | {
      ok: false;
      reasons: string[];
    };

function clean(value?: string | null) {
  return value?.trim() ?? "";
}

export function validateDirectImmobilie1SendInput(
  input: DirectImmobilie1SendInput
): DirectImmobilie1SendValidation {
  const firstName = clean(input.firstName);
  const lastName = clean(input.lastName);
  const contactEmail = clean(input.contactEmail);
  const salutation = clean(input.salutation);
  const message = clean(input.message);
  const reasons: string[] = [];

  if (!firstName || !lastName) {
    reasons.push("Vollstaendiger Name fehlt.");
  }
  if (!contactEmail) {
    reasons.push("Kontakt-E-Mail fehlt.");
  }
  if (!salutation) {
    reasons.push("Anrede fehlt.");
  }
  if (message.length < 20) {
    reasons.push("Anschreiben ist zu kurz.");
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }

  return {
    ok: true,
    values: {
      fullName: `${firstName} ${lastName}`,
      contactEmail,
      salutation,
      message
    }
  };
}
