import type { ApplicationStatus, ContactMethod, ListingStatus } from "@prisma/client";

export const listingStatusLabels: Record<ListingStatus, string> = {
  NEW: "Neu",
  NOTIFIED: "Benachrichtigt",
  IGNORED: "Ignoriert",
  DUPLICATE: "Duplikat",
  APPLIED: "Beworben",
  ERROR: "Fehler"
};

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  DRAFT: "Entwurf",
  PENDING_APPROVAL: "Wartet auf Freigabe",
  APPROVED: "Freigegeben",
  PREPARING: "Wird vorbereitet",
  READY_TO_SUBMIT: "Bereit zur Prüfung",
  SENT: "Versendet",
  FAILED: "Fehler",
  IGNORED: "Ignoriert"
};

export const contactMethodLabels: Record<ContactMethod, string> = {
  FORM: "Kontaktformular",
  EMAIL: "E-Mail",
  EXTERNAL: "Externer Bewerbungslink"
};
