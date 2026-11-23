"""Explicit supplier abbreviations used in the supplied combined tour sheets.

No edit-distance/fuzzy matching: every supported abbreviation has a fixed target.
The caller still requires a unique hotel or assignment with that canonical name.
"""

from app.services.excel_pricing import _hotel_identity_key

_SUPPLIER_NAMES = {
    "ASTO": "Asto Hotel Kuala Lumpur",
    "LAZDANA": "Lazdana Hotel Kuala Lumpur",
    "PACIFIC EXPRESS CHINA TOWN": "Pacific Express Hotel Chinatown",
    "IBIS STYLE BUKITBINGTANG": "ibis Styles Kuala Lumpur Bukit Bintang",
    "STEGE": "STEG Kuala Lumpur",
    "UPER VIEW REGALIA": "Regalia Upper View Hotel (Upper View Regalia)",
    "Regalia Upper View Hotel": "Regalia Upper View Hotel (Upper View Regalia)",
    "FURUMA": "Furama Bukit Bintang",
    "FURMA": "Furama Bukit Bintang",
    "SOFITEL BALI NUSA DUA BEACH RESORT": "SOFITEL NUSA DUA",
    "THE LAGUNA, A LUXURY COLLECTION RESORT & SPA, NUSA DUA": "LAGUNA NUSA DUA",
    "OAKWOOD": "Oakwood Hotel & Residence Kuala Lumpur",
    "ROYAL": "Hotel Royal Kuala Lumpur",
    "HOLIDAY INN EXPRESS": "Holiday Inn Express Kuala Lumpur City Centre",
    "IIMPIANA KLCC": "Impiana KLCC Hotel",
    "MERCURE": "Mercure Kuala Lumpur",
    "IBIS KLCC": "ibis Kuala Lumpur City Centre",
    "ROYAL CHULAN": "Hotel Royal Chulan Kuala Lumpur",
    "ROYAL SIGNATURE": "Hotel Royal Signature",
    "GRAND MERCURE": "Grand Mercure Kuala Lumpur",
    "FOUR POINT BY SHERATON": "Four Points by Sheraton Kuala Lumpur, City Centre",
    "THE FACE STYLE": "THE FACE Suites",
    "SHANGRI LA": "Shangri-La Kuala Lumpur",
    "PARK ROYAL COLLECTION": "PARKROYAL COLLECTION Kuala Lumpur",
    "RENAISSANCE": "Renaissance Kuala Lumpur Hotel",
    "SHERATON IMPERIAL": "Sheraton Imperial Kuala Lumpur",
    "INTERCONTINENTAL": "InterContinental Kuala Lumpur",
    "GRAND MILLENNIUM": "Grand Millennium Kuala Lumpur",
    "JW MARRIOT": "JW Marriott Kuala Lumpur",
    "IMPERIAL LEXIS": "Imperial Lexis Kuala Lumpur",
    "EQ HOTEL": "EQ Hotel Kuala Lumpur",
    "IBIS BUDGET GOLD": "ibis budget Singapore Gold",
    "VALUE THOMOS/IBIS BUDGET": "Value Hotel Thomson",
    "BIS BUDGET CLARY QUAY": "ibis budget Singapore Clarke Quay",
    "IBIS STYLE ALBERT": "ibis Styles Singapore Albert",
    "GRAND CENTRAL ORCHARD": "Hotel Grand Central Singapore",
    "ROYAL NEWTON": "Hotel Royal Singapore",
    "V LAVENDER": "V Hotel Lavender",
    "CHANCELLOR ORCHARD": "Hotel Chancellor@Orchard",
    "MERCURE thyrwhite": "Mercure Singapore Tyrwhitt",
    "BOOS HOTEL": "Hotel Boss",
    "TRAVELTIINE": "Hotel Traveltine Downtown Singapore",
    "STUDIO M": "Studio M Hotel Singapore",
    "GRAND PACIFIC": "Hotel Grand Pacific Singapore",
    "MI BENCOOLEN": "Hotel Mi Bencoolen",
    "ORCHARD RENDEZVOUS": "Orchard Rendezvous Hotel",
    "ORCHARD HOTEL": "Orchard Hotel Singapore",
    "ORCHARD": "Orchard Hotel Singapore",
    "MERCURE ICON CITY": "Mercure ICON Singapore City Centre",
    "GRAND COPTHORNE water front": "Grand Copthorne Waterfront Hotel Singapore",
    "CONCORD": "Concorde Hotel Singapore",
    "GOODWOOD PARK": "Goodwood Park Hotel",
    "WYNDHAM SINGAPORE": "Wyndham Singapore Hotel",
    "PULLMAN ORCHARD": "Pullman Singapore Orchard",
    "PARKROYAL COLLECTION": "PARKROYAL COLLECTION Marina Bay, Singapore",
    "SHERATON TOWER": "Sheraton Towers Singapore",
    "BELLAVISTA Waterfront": "Bella Vista Waterfront Resort",
    "Aloft by Marriott Langkawi Pantai Tengah": "Aloft Langkawi Pantai Tengah",
}
ALIASES = {
    _hotel_identity_key(key): _hotel_identity_key(value)
    for key, value in _SUPPLIER_NAMES.items()
}


def combined_hotel_key(name: str) -> str:
    key = _hotel_identity_key(name)
    return ALIASES.get(key, key)
