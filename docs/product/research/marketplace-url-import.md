# Marketplace URL Import Research

Accessed 2026-08-24. This note asks whether Wishlist can turn an arbitrary Avito, Ozon, or Wildberries product URL into a reliable Wishlist Item card.

## Conclusion

None of the three marketplaces documents an official API for reading an arbitrary public product card from a pasted retail URL. Their official product APIs are scoped to an authenticated seller or listing owner. An identifier parsed from a public URL is therefore not authorization to query that card through the seller API.

Public HTML may incidentally contain Open Graph or JSON-LD metadata, but no provider promises those fields or server-side accessibility as an import contract. The product must offer **best-effort preview with manual fallback**, not “supported marketplace parsing.” Browser automation and private retail endpoints are deliberately excluded.

## Provider evidence

| Provider    | Official API boundary                                                                                                                                                                                                                                                                                                                                                                                            | Public-page metadata                                                                                                                                                                                                                                                                                                 | Operational conclusion                                                                                                                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Avito       | Avito's item API is account-scoped, for example `GET /core/v1/accounts/{user_id}/items/{item_id}/`. Its API terms restrict the API to the authorized user's listing database: [developer portal](https://developers.avito.ru/api-catalog/item/documentation), [API terms §§2.1–2.2](https://www.avito.ru/legal/pro_tools/public-api).                                                                            | A category page exposed Open Graph and JSON-LD during research, but an individual listing returned HTTP 439. Avito does not document those tags as a card-import contract. Its [robots.txt](https://www.avito.ru/robots.txt) also blocks many internal and parameterized paths; robots rules are not an API licence. | Use an official API only for a deliberately connected owner's listings. Treat public HTML as optional, policy-reviewed input that can fail at any time.                                                                                             |
| Ozon        | [Ozon Seller API](https://docs.ozon.ru/api/seller/) uses seller `Client-Id` and `Api-Key` credentials. Product methods such as `POST /v3/product/info/list` and `POST /v3/products/info/attributes` operate on seller identifiers, not pasted retail URLs. Ozon's [official Seller API change notice](https://t.me/s/OzonSellerAPI/157) identifies v3 product info as the replacement for deprecated v2 methods. | No first-party guarantee for Open Graph or JSON-LD on retail product pages was found. A direct retail-page read timed out from the research environment; this is an observation, not proof of universal blocking.                                                                                                    | Do not replay retail private endpoints or assume a seller API can read another seller's SKU. Fall back to manual fields when a bounded HTML fetch fails.                                                                                            |
| Wildberries | [Wildberries Content API](https://dev.wildberries.ru/docs/openapi/work-with-products) exposes the authenticated seller's cards through `POST /content/v2/get/cards/list`; it requires an `Authorization` token with the Content category. [API information](https://dev.wildberries.ru/ru/openapi/api-information) documents token categories, `429`, and rate-limit headers.                                    | No first-party guarantee for retail Open Graph or JSON-LD was found. Retail product and robots requests returned HTTP 498 from the research environment; this is dated anti-automation evidence, not a stable response contract.                                                                                     | A retail `nmID` is not proof that the caller may read another seller's card through Content API. The documented card-list category currently publishes 100 requests/minute, a 600 ms interval, and burst 5; verify live docs before implementation. |

Wildberries' seller-portal terms additionally state that automated third-party integration with the seller portal is allowed only through Public API: [portal terms §9.9.6](https://seller.wildberries.ru/instructions/ru/ru/material/site-using-terms). No equivalent first-party statement granting arbitrary retail HTML extraction was found for any provider. Absence of a located prohibition is not permission; provider-policy review remains an implementation gate.

## Product boundary

1. Accept an optional source URL on a Wishlist Item.
2. Normalize the URL without fetching it. Accept HTTPS only, remove fragments and known tracking parameters, reject user-info, unexpected ports, malformed values, and look-alike hosts.
3. Fetch metadata only for a curated registry of exact provider domains and allowed product-path shapes.
4. Use an official API only when the User deliberately connected the relevant seller/business account and the requested card belongs to that account.
5. Otherwise perform one bounded best-effort HTML fetch and validate `og:title`, `og:image`, `og:description`, or schema.org `Product` data as untrusted suggestions. [The Open Graph protocol](https://ogp.me/) defines metadata fields; it does not guarantee that a marketplace serves them.
6. Return an Import Preview for User review. Missing, ambiguous, challenged, or timed-out metadata produces a manual-entry result, not a failed Wishlist Item.
7. Never use headless-browser automation, challenge bypasses, or undocumented retail APIs as a fallback.

## SSRF and resource controls

A pasted URL is attacker-controlled network input. Follow the [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html):

- resolve every A and AAAA record and reject loopback, private, link-local, multicast, unspecified, and cloud-metadata ranges;
- pin the validated resolution for the connection so DNS cannot change after validation;
- disable redirects, or repeat the complete scheme, host, and address validation on every hop;
- send no cookies, authorization headers, proxy credentials, or ambient User headers;
- enforce short connect and total timeouts, header/body/decompression limits, accepted HTML content types, and bounded concurrency;
- isolate fetches in a worker with restricted egress and cache results by normalized URL to limit provider load;
- do not fetch a preview image in the metadata request. After object storage exists, validate and copy an accepted image through a separate bounded pipeline.

## Chosen rollout

- **Core release:** optional URL plus manual title, price, priority, and comment; no external fetch is required to create a Wishlist Item.
- **Import iteration:** asynchronous Import Preview jobs, curated allowlist, generic Open Graph/JSON-LD extraction, and manual fallback.
- **Image iteration:** copy an accepted remote image into service-owned S3-compatible storage after type and size validation; never hotlink it in the permanent Item.
- **Refresh iteration:** produce a new preview and diff for explicit User application. A later price-monitoring feature may store observations and alerts, but must not silently overwrite the user-owned snapshot.
- **Seller integrations:** separate future feature available only when a User connects an authorized seller account. It is not a fallback for arbitrary public URLs.
