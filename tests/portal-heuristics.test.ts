import assert from "node:assert/strict";
import test from "node:test";
import { extractContactPerson, isUnavailableListingPage, looksLikeListingPage } from "../lib/portals/heuristics";

test("detects clear unavailable listing pages without treating normal listing copy as unavailable", () => {
  assert.equal(isUnavailableListingPage("Die Immobilie, die Sie suchen, ist leider nicht mehr verfuegbar."), true);
  assert.equal(isUnavailableListingPage("Dieses Angebot wurde bereits deaktiviert."), true);
  assert.equal(isUnavailableListingPage("Diese Wohnung ist sofort verfuegbar und hat zwei Zimmer."), false);
});

test("prefers no contact person over broad page-text false positives", () => {
  assert.deepEqual(extractContactPerson("Ansprechpartner: Frau Maria Schmidt\nKontakt aufnehmen"), {
    salutation: "Frau",
    name: "Maria Schmidt"
  });
  assert.equal(
    extractContactPerson("Frau Immobilien GmbH Anbieter kontaktieren Details zur Wohnung"),
    undefined
  );
  assert.equal(extractContactPerson("Kontakt Informationen Anbieter kontaktieren Anfrage senden"), undefined);
  assert.equal(extractContactPerson("Ansprechpartner: Jetzt bewerben"), undefined);
  assert.equal(extractContactPerson("Kontaktperson: Online Bewerbung Anfrage senden"), undefined);
});

test("rejects broken search or replacement pages as non-listings", () => {
  assert.equal(
    looksLikeListingPage({
      title: "Suche | Immobilienportal",
      description: "1.248 Wohnungen zur Miete in Hamburg",
      allText: "Suchergebnisse Filter Sortieren 1.248 Wohnungen zur Miete",
      links: []
    }),
    false
  );
  assert.equal(
    looksLikeListingPage({
      title: "Suchergebnisse | Wohnungen zur Miete",
      description: "Helle 2 Zimmer Wohnung Warmmiete 850 EUR 54 m2 Anbieter kontaktieren",
      allText:
        "Suchergebnisse Filter Sortieren 1.248 Wohnungen zur Miete Helle 2 Zimmer Wohnung Warmmiete 850 EUR 54 m2 Anbieter kontaktieren",
      links: [{ text: "Anbieter kontaktieren", href: "https://example.test/listing-card/contact" }]
    }),
    false
  );
  assert.equal(
    looksLikeListingPage({
      title: "Wohnungen zur Miete Hamburg",
      description:
        "Suchergebnisse Filter Sortieren Wohnungen zur Miete Hamburg Warmmiete 850 EUR 2 Zimmer 54 m2 Anbieter kontaktieren",
      allText:
        "Suchergebnisse Filter Sortieren Wohnungen zur Miete Hamburg Warmmiete 850 EUR 2 Zimmer 54 m2 Anbieter kontaktieren",
      links: [
        { text: "Anbieter kontaktieren", href: "https://example.test/listing-card/contact" },
        { text: "Jetzt bewerben", href: "https://example.test/listing-card/apply" }
      ]
    }),
    false
  );
  assert.equal(
    looksLikeListingPage({
      title: "Dieses Angebot ist nicht mehr verfuegbar",
      description: "Aehnliche Angebote Helle 2 Zimmer Wohnung Warmmiete 850 EUR",
      allText: "Dieses Angebot ist nicht mehr verfuegbar Aehnliche Angebote Kontakt Anbieter kontaktieren 54 m2",
      links: [{ text: "Anbieter kontaktieren", href: "https://example.test/replacement/contact" }]
    }),
    false
  );
  assert.equal(
    looksLikeListingPage({
      title: "Helle 2 Zimmer Wohnung",
      description: "Warmmiete 850 EUR, 54 m2, Balkon",
      allText: "Helle 2 Zimmer Wohnung Warmmiete 850 EUR 54 m2 Anbieter kontaktieren",
      links: []
    }),
    true
  );
});
