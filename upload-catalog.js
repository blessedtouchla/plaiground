/**
 * Upload form catalogs.
 *
 * Genres: ToneGrid changelog (v1.0.7) says they have one canonical list of 187
 * genres. OpenAPI https://api-docs.tonegrid.pro/openapi.json has no genre enum
 * and no subgenre/sub_genre. GET /genres and /supply-chain/genres 404 on
 * api-sandbox.tonegrid.pro. This list is the complete public Apple Music
 * (iTunes) Music genre tree plus ToneGrid's documented example strings
 * Afrobeats and Afropop. Not ToneGrid's unpublished 187.
 *
 * Subgenre is not added: OpenAPI create/update bodies only document genre.
 *
 * Languages: complete ISO 639-1 (two-letter) codes. Option value is the code.
 *
 * Human tags: the live attest human-contribution list. Profile specialties
 * reuse this exact set so community browse can later show lyrics / beats.
 */
'use strict';

const GENRES = [
  "21st Century",
  "Acoustic Blues",
  "Adult Alternative",
  "Adult Contemporary",
  "African",
  "African Dancehall",
  "African Reggae",
  "Afrikaans",
  "Afro House",
  "Afro Soul",
  "Afro-Beat",
  "Afro-folk",
  "Afro-fusion",
  "Afro-Pop",
  "Afrobeats",
  "Afropop",
  "Air de Cours",
  "Alte",
  "Alternative",
  "Alternative Country",
  "Alternative Folk",
  "Alternative Rap",
  "Amapiano",
  "Ambient",
  "American Trad Rock",
  "Americana",
  "Anime",
  "Arabesque",
  "Arabic",
  "Arabic Pop",
  "Arena Rock",
  "Ars Antiqua",
  "Ars Nova",
  "Art Song",
  "Asia",
  "Assamese",
  "Australia",
  "Avant-Garde",
  "Avant-Garde Jazz",
  "Axé",
  "Baile Funk",
  "Baladas y Boleros",
  "Ballet",
  "Bard in Russian",
  "Baroque",
  "Baroque Era",
  "Bass",
  "Bel Canto",
  "Benga",
  "Bengali",
  "Bhojpuri",
  "Big Band",
  "Bluegrass",
  "Blues",
  "Blues-Rock",
  "Bolero",
  "Bollywood",
  "Bongo-Flava",
  "Bop",
  "Bossa Nova",
  "Brass & Woodwinds",
  "Brazilian",
  "Breakbeat",
  "British Invasion",
  "Britpop",
  "C-Pop",
  "Cajun",
  "Calypso",
  "Cantata",
  "Cantopop/HK-Pop",
  "Caribbean",
  "Carnatic Classical",
  "Carol",
  "CCM",
  "Cello",
  "Celtic",
  "Celtic Folk",
  "Chachacha",
  "Chamber Music",
  "Chanson",
  "Chanson in Russian",
  "Chant",
  "Chanukah",
  "Chicago Blues",
  "Children's Music",
  "Chimurenga",
  "Chinese",
  "Chinese Alt",
  "Chinese Classical",
  "Chinese Flute",
  "Chinese Hip-Hop",
  "Chinese Opera",
  "Chinese Orchestral",
  "Chinese Regional Folk",
  "Chinese Rock",
  "Chinese Strings",
  "Choral",
  "Choro",
  "Christian",
  "Christian Metal",
  "Christian Pop",
  "Christian Rap",
  "Christian Rock",
  "Christmas",
  "Christmas: Children's",
  "Christmas: Classic",
  "Christmas: Classical",
  "Christmas: Country",
  "Christmas: Jazz",
  "Christmas: Modern",
  "Christmas: Pop",
  "Christmas: R&B",
  "Christmas: Religious",
  "Christmas: Rock",
  "Classic Blues",
  "Classic Christian",
  "Classical",
  "Classical Crossover",
  "College Rock",
  "Comedy",
  "Concert Aria",
  "Concerto",
  "Concerto Grosso",
  "Contemporary Bluegrass",
  "Contemporary Blues",
  "Contemporary Celtic",
  "Contemporary Country",
  "Contemporary Era",
  "Contemporary Folk",
  "Contemporary Gospel",
  "Contemporary Jazz",
  "Contemporary Latin",
  "Contemporary R&B",
  "Contemporary Singer/Songwriter",
  "Cool Jazz",
  "Country",
  "Country Blues",
  "Country Gospel",
  "Country Hip-Hop/Rap",
  "Coupé-Décalé",
  "Crossover Jazz",
  "Cuban",
  "Dabke",
  "Dance",
  "Dangdut",
  "Death Metal/Black Metal",
  "Delta Blues",
  "Deutschpop",
  "Deutschrap",
  "Devotional & Spiritual",
  "Dini",
  "Dirty South",
  "Disco",
  "Disney",
  "Dixieland",
  "Dodecaphony",
  "Doo Wop",
  "Downtempo",
  "Drinking Songs",
  "Dub",
  "Dubstep",
  "Early 20th Century",
  "Early Music",
  "Early Romantic",
  "East Coast Rap",
  "Easter",
  "Easy Listening",
  "Eclecticism",
  "Egyptian Hip-Hop",
  "Egyptian Pop",
  "Egyptian Tarab",
  "Electric Blues",
  "Electro-Cha'abi",
  "Electroacoustic",
  "Electronic",
  "Electronica",
  "EMO",
  "English Ayre",
  "Enka",
  "Environmental",
  "Ethio Jazz",
  "Europe",
  "Exercise",
  "Experimental Classical",
  "Expressionism",
  "Fado",
  "Fantasy",
  "Fantezi",
  "Farsi",
  "Film Music",
  "First Viennese School",
  "Fitness & Workout",
  "Flamenco",
  "Folk",
  "Folk-Rock",
  "Foreign Cinema",
  "Forró",
  "France",
  "French Baroque",
  "French Pop",
  "Frevo",
  "Fuji",
  "Funk",
  "Fusion",
  "Gangsta Rap",
  "Garage",
  "Genge",
  "German Folk",
  "German Pop",
  "Ghanaian Drill",
  "Ghazals",
  "Glam Rock",
  "Gospel",
  "Goth Rock",
  "Gqom",
  "Gregorian Chant",
  "Grunge",
  "Guajira",
  "Guaracha",
  "Guitar",
  "Gujarati",
  "Hair Metal",
  "Halk",
  "Halloween",
  "Hard Bop",
  "Hard Rock",
  "Hardcore",
  "Hardcore Rap",
  "Haryanvi",
  "Hawaii",
  "Healing",
  "High Classical",
  "Highlife",
  "Hindustani Classical",
  "Hip-Hop",
  "Hip-Hop in Russian",
  "Hip-Hop/Rap",
  "Holiday",
  "Holiday: Other",
  "Honky Tonk",
  "Hörspiele",
  "House",
  "Iberia",
  "IDM/Experimental",
  "Impressionism",
  "Impressionist",
  "Indian",
  "Indian Classical",
  "Indian Folk",
  "Indian Pop",
  "Indie Egyptian",
  "Indie Levant",
  "Indie Maghreb",
  "Indie Pop",
  "Indie Rock",
  "Indo Pop",
  "Indonesian Religious",
  "Industrial",
  "Inspirational",
  "Instrumental",
  "Iraqi Folk",
  "Iraqi Pop",
  "Iraqi Tarab",
  "Islamic",
  "Israeli",
  "J-Pop",
  "Jam Bands",
  "Japan",
  "Japanese Pop",
  "Jazz",
  "Jewish Holidays",
  "Jewish Music",
  "Jungle/Drum'n'bass",
  "K-Pop",
  "Kannada",
  "Karaoke",
  "Kayokyoku",
  "Khaleeji",
  "Khaleeji Folk",
  "Khaleeji Hip-Hop",
  "Khaleeji Jalsat",
  "Khaleeji Pop",
  "Khaleeji Shailat",
  "Khaleeji Tarab",
  "Kizomba",
  "Klezmer",
  "Korean",
  "Korean Classical",
  "Korean Folk-Pop",
  "Korean Hip-Hop",
  "Korean Indie",
  "Korean Rock",
  "Korean Trad Instrumental",
  "Korean Trad Song",
  "Korean Trad Theater",
  "Kuduro",
  "Kwaito",
  "Kwassa",
  "Late 20th Century",
  "Late Romantic",
  "Latin",
  "Latin Jazz",
  "Latin Rap",
  "Levant",
  "Levant Electronic",
  "Levant Hip-Hop",
  "Levant Pop",
  "Lied",
  "Lounge",
  "Lovers Rock",
  "Lullabies",
  "Maghreb Dance",
  "Maghreb Electronic",
  "Maghreb Hip-Hop",
  "Maghreb Pop",
  "Maghreb Rai",
  "Mainstream Jazz",
  "Malayalam",
  "Malaysian Pop",
  "Mambo",
  "Mandopop",
  "Manilla Sound",
  "Mapouka",
  "Marathi",
  "Marching",
  "Maskandi",
  "Mass",
  "Mbalax",
  "Medieval",
  "Medieval Era",
  "Meditation",
  "Meistergesang",
  "Metal",
  "Minimalism",
  "Minnesang",
  "Modern Dancehall",
  "Modern Era",
  "Modernism",
  "Motown",
  "MPB",
  "Music Theatre",
  "Música Mexicana",
  "Música tropical",
  "Musicals",
  "Musique concrète",
  "Nationalism",
  "Nature",
  "Ndombolo",
  "Neo-Soul",
  "Neoclassicism",
  "New Acoustic",
  "New Age",
  "New Complexity",
  "New Simplicity",
  "New Wave",
  "Nocturne",
  "North African",
  "North America",
  "Novelty",
  "Odia",
  "Old School Rap",
  "Oldies",
  "Opera",
  "Oratorio",
  "Orchestral",
  "Original Pilipino Music",
  "Original Score",
  "Outlaw Country",
  "Özgün",
  "Pagode",
  "Passion",
  "Percussion",
  "Piano",
  "Pinoy Pop",
  "Polka",
  "Polyphony",
  "Polystylism",
  "Pop",
  "Pop in Russian",
  "Pop Latino",
  "Pop Punk",
  "Pop/Rock",
  "Post-modernism",
  "PostMinimalism",
  "Praise & Worship",
  "Prima Pratica",
  "Prog-Rock/Art Rock",
  "Psychedelic",
  "Punjabi",
  "Punjabi Pop",
  "Punk",
  "Quiet Storm",
  "R&B/Soul",
  "Rabindra Sangeet",
  "Ragtime",
  "Raíces",
  "Rajasthani",
  "Rap",
  "Reggae",
  "Regional Indian",
  "Relaxation",
  "Religious",
  "Renaissance",
  "Rock",
  "Rock & Roll",
  "Rock in Russian",
  "Rock y Alternativo",
  "Rockabilly",
  "Romance in Russian",
  "Romantic",
  "Romantic Era",
  "Roots Reggae",
  "Roots Rock",
  "Russian",
  "Sacred",
  "Samba",
  "Sanat",
  "Second Viennese School",
  "Seconda Pratica",
  "Serialism",
  "Sertanejo",
  "Shangaan Electro",
  "Shows",
  "Sing-Along",
  "Singer/Songwriter",
  "Ska",
  "Smooth Jazz",
  "Soca",
  "Soft Rock",
  "Solo Instrumental",
  "Son",
  "Sonata",
  "Soukous",
  "Soul",
  "Sound Effects",
  "Soundtrack",
  "South Africa",
  "South African Hip-Hop",
  "South America",
  "Southern Gospel",
  "Southern Rock",
  "Spectral Music",
  "Spoken Word",
  "Stage Works",
  "Standards",
  "Standup Comedy",
  "Stories",
  "String Quartet",
  "Sufi",
  "Surf",
  "Swing",
  "Symphony",
  "T-Pop",
  "Taarab",
  "Tai-Pop",
  "Taiwanese Folk",
  "Tamil",
  "Tango",
  "Tarab",
  "Techno",
  "Teen Pop",
  "Telugu",
  "Tex-Mex",
  "Thai Country",
  "Thai Pop",
  "Thanksgiving",
  "Tibetan Native Music",
  "Timba",
  "Tone Poem",
  "Trad Jazz",
  "Traditional Bluegrass",
  "Traditional Celtic",
  "Traditional Country",
  "Traditional Folk",
  "Traditional Gospel",
  "Traditional Pop",
  "Trance",
  "Travel",
  "Tribute",
  "Trot",
  "Troubadour Music",
  "Trouvère Music",
  "Turkish",
  "Turkish Alternative",
  "Turkish Hip-Hop/Rap",
  "Turkish Pop",
  "Turkish Rock",
  "TV Soundtrack",
  "UK Hip-Hop",
  "Underground Rap",
  "Urban Cowboy",
  "Urbano latino",
  "Urdu",
  "Video Game",
  "Violin",
  "Vocal",
  "Vocal Jazz",
  "Vocal Music",
  "Vocal Pop",
  "Wedding Music",
  "West Coast Rap",
  "Worldbeat",
  "Worldwide",
  "Yoga",
  "Zouglou",
  "Zydeco"
];

const LANGUAGES = [
  {
    "code": "ab",
    "name": "Abkhazian"
  },
  {
    "code": "aa",
    "name": "Afar"
  },
  {
    "code": "af",
    "name": "Afrikaans"
  },
  {
    "code": "ak",
    "name": "Akan"
  },
  {
    "code": "tw",
    "name": "Akan"
  },
  {
    "code": "sq",
    "name": "Albanian"
  },
  {
    "code": "am",
    "name": "Amharic"
  },
  {
    "code": "ar",
    "name": "Arabic"
  },
  {
    "code": "an",
    "name": "Aragonese"
  },
  {
    "code": "hy",
    "name": "Armenian"
  },
  {
    "code": "as",
    "name": "Assamese"
  },
  {
    "code": "av",
    "name": "Avaric"
  },
  {
    "code": "ae",
    "name": "Avestan"
  },
  {
    "code": "ay",
    "name": "Aymara"
  },
  {
    "code": "az",
    "name": "Azerbaijani"
  },
  {
    "code": "bm",
    "name": "Bambara"
  },
  {
    "code": "bn",
    "name": "Bangla"
  },
  {
    "code": "ba",
    "name": "Bashkir"
  },
  {
    "code": "eu",
    "name": "Basque"
  },
  {
    "code": "be",
    "name": "Belarusian"
  },
  {
    "code": "bi",
    "name": "Bislama"
  },
  {
    "code": "bs",
    "name": "Bosnian"
  },
  {
    "code": "br",
    "name": "Breton"
  },
  {
    "code": "bg",
    "name": "Bulgarian"
  },
  {
    "code": "my",
    "name": "Burmese"
  },
  {
    "code": "ca",
    "name": "Catalan"
  },
  {
    "code": "ch",
    "name": "Chamorro"
  },
  {
    "code": "ce",
    "name": "Chechen"
  },
  {
    "code": "zh",
    "name": "Chinese"
  },
  {
    "code": "cu",
    "name": "Church Slavic"
  },
  {
    "code": "cv",
    "name": "Chuvash"
  },
  {
    "code": "kw",
    "name": "Cornish"
  },
  {
    "code": "co",
    "name": "Corsican"
  },
  {
    "code": "cr",
    "name": "Cree"
  },
  {
    "code": "hr",
    "name": "Croatian"
  },
  {
    "code": "cs",
    "name": "Czech"
  },
  {
    "code": "da",
    "name": "Danish"
  },
  {
    "code": "dv",
    "name": "Divehi"
  },
  {
    "code": "nl",
    "name": "Dutch"
  },
  {
    "code": "dz",
    "name": "Dzongkha"
  },
  {
    "code": "en",
    "name": "English"
  },
  {
    "code": "eo",
    "name": "Esperanto"
  },
  {
    "code": "et",
    "name": "Estonian"
  },
  {
    "code": "ee",
    "name": "Ewe"
  },
  {
    "code": "fo",
    "name": "Faroese"
  },
  {
    "code": "fj",
    "name": "Fijian"
  },
  {
    "code": "tl",
    "name": "Filipino"
  },
  {
    "code": "fi",
    "name": "Finnish"
  },
  {
    "code": "fr",
    "name": "French"
  },
  {
    "code": "ff",
    "name": "Fula"
  },
  {
    "code": "gl",
    "name": "Galician"
  },
  {
    "code": "lg",
    "name": "Ganda"
  },
  {
    "code": "ka",
    "name": "Georgian"
  },
  {
    "code": "de",
    "name": "German"
  },
  {
    "code": "el",
    "name": "Greek"
  },
  {
    "code": "gn",
    "name": "Guarani"
  },
  {
    "code": "gu",
    "name": "Gujarati"
  },
  {
    "code": "ht",
    "name": "Haitian Creole"
  },
  {
    "code": "ha",
    "name": "Hausa"
  },
  {
    "code": "he",
    "name": "Hebrew"
  },
  {
    "code": "hz",
    "name": "Herero"
  },
  {
    "code": "hi",
    "name": "Hindi"
  },
  {
    "code": "ho",
    "name": "Hiri Motu"
  },
  {
    "code": "hu",
    "name": "Hungarian"
  },
  {
    "code": "is",
    "name": "Icelandic"
  },
  {
    "code": "io",
    "name": "Ido"
  },
  {
    "code": "ig",
    "name": "Igbo"
  },
  {
    "code": "id",
    "name": "Indonesian"
  },
  {
    "code": "ia",
    "name": "Interlingua"
  },
  {
    "code": "ie",
    "name": "Interlingue"
  },
  {
    "code": "iu",
    "name": "Inuktitut"
  },
  {
    "code": "ik",
    "name": "Inupiaq"
  },
  {
    "code": "ga",
    "name": "Irish"
  },
  {
    "code": "it",
    "name": "Italian"
  },
  {
    "code": "ja",
    "name": "Japanese"
  },
  {
    "code": "jv",
    "name": "Javanese"
  },
  {
    "code": "kl",
    "name": "Kalaallisut"
  },
  {
    "code": "kn",
    "name": "Kannada"
  },
  {
    "code": "kr",
    "name": "Kanuri"
  },
  {
    "code": "ks",
    "name": "Kashmiri"
  },
  {
    "code": "kk",
    "name": "Kazakh"
  },
  {
    "code": "km",
    "name": "Khmer"
  },
  {
    "code": "ki",
    "name": "Kikuyu"
  },
  {
    "code": "rw",
    "name": "Kinyarwanda"
  },
  {
    "code": "kv",
    "name": "Komi"
  },
  {
    "code": "kg",
    "name": "Kongo"
  },
  {
    "code": "ko",
    "name": "Korean"
  },
  {
    "code": "kj",
    "name": "Kuanyama"
  },
  {
    "code": "ku",
    "name": "Kurdish"
  },
  {
    "code": "ky",
    "name": "Kyrgyz"
  },
  {
    "code": "lo",
    "name": "Lao"
  },
  {
    "code": "la",
    "name": "Latin"
  },
  {
    "code": "lv",
    "name": "Latvian"
  },
  {
    "code": "li",
    "name": "Limburgish"
  },
  {
    "code": "ln",
    "name": "Lingala"
  },
  {
    "code": "lt",
    "name": "Lithuanian"
  },
  {
    "code": "lu",
    "name": "Luba-Katanga"
  },
  {
    "code": "lb",
    "name": "Luxembourgish"
  },
  {
    "code": "mk",
    "name": "Macedonian"
  },
  {
    "code": "mg",
    "name": "Malagasy"
  },
  {
    "code": "ms",
    "name": "Malay"
  },
  {
    "code": "ml",
    "name": "Malayalam"
  },
  {
    "code": "mt",
    "name": "Maltese"
  },
  {
    "code": "gv",
    "name": "Manx"
  },
  {
    "code": "mi",
    "name": "Māori"
  },
  {
    "code": "mr",
    "name": "Marathi"
  },
  {
    "code": "mh",
    "name": "Marshallese"
  },
  {
    "code": "mn",
    "name": "Mongolian"
  },
  {
    "code": "na",
    "name": "Nauru"
  },
  {
    "code": "nv",
    "name": "Navajo"
  },
  {
    "code": "ng",
    "name": "Ndonga"
  },
  {
    "code": "ne",
    "name": "Nepali"
  },
  {
    "code": "nd",
    "name": "North Ndebele"
  },
  {
    "code": "se",
    "name": "Northern Sami"
  },
  {
    "code": "no",
    "name": "Norwegian"
  },
  {
    "code": "nb",
    "name": "Norwegian Bokmål"
  },
  {
    "code": "nn",
    "name": "Norwegian Nynorsk"
  },
  {
    "code": "ny",
    "name": "Nyanja"
  },
  {
    "code": "oc",
    "name": "Occitan"
  },
  {
    "code": "or",
    "name": "Odia"
  },
  {
    "code": "oj",
    "name": "Ojibwa"
  },
  {
    "code": "om",
    "name": "Oromo"
  },
  {
    "code": "os",
    "name": "Ossetic"
  },
  {
    "code": "pi",
    "name": "Pali"
  },
  {
    "code": "ps",
    "name": "Pashto"
  },
  {
    "code": "fa",
    "name": "Persian"
  },
  {
    "code": "pl",
    "name": "Polish"
  },
  {
    "code": "pt",
    "name": "Portuguese"
  },
  {
    "code": "pa",
    "name": "Punjabi"
  },
  {
    "code": "qu",
    "name": "Quechua"
  },
  {
    "code": "ro",
    "name": "Romanian"
  },
  {
    "code": "rm",
    "name": "Romansh"
  },
  {
    "code": "rn",
    "name": "Rundi"
  },
  {
    "code": "ru",
    "name": "Russian"
  },
  {
    "code": "sm",
    "name": "Samoan"
  },
  {
    "code": "sg",
    "name": "Sango"
  },
  {
    "code": "sa",
    "name": "Sanskrit"
  },
  {
    "code": "sc",
    "name": "Sardinian"
  },
  {
    "code": "gd",
    "name": "Scottish Gaelic"
  },
  {
    "code": "sr",
    "name": "Serbian"
  },
  {
    "code": "sn",
    "name": "Shona"
  },
  {
    "code": "ii",
    "name": "Sichuan Yi"
  },
  {
    "code": "sd",
    "name": "Sindhi"
  },
  {
    "code": "si",
    "name": "Sinhala"
  },
  {
    "code": "sk",
    "name": "Slovak"
  },
  {
    "code": "sl",
    "name": "Slovenian"
  },
  {
    "code": "so",
    "name": "Somali"
  },
  {
    "code": "nr",
    "name": "South Ndebele"
  },
  {
    "code": "st",
    "name": "Southern Sotho"
  },
  {
    "code": "es",
    "name": "Spanish"
  },
  {
    "code": "su",
    "name": "Sundanese"
  },
  {
    "code": "sw",
    "name": "Swahili"
  },
  {
    "code": "ss",
    "name": "Swati"
  },
  {
    "code": "sv",
    "name": "Swedish"
  },
  {
    "code": "ty",
    "name": "Tahitian"
  },
  {
    "code": "tg",
    "name": "Tajik"
  },
  {
    "code": "ta",
    "name": "Tamil"
  },
  {
    "code": "tt",
    "name": "Tatar"
  },
  {
    "code": "te",
    "name": "Telugu"
  },
  {
    "code": "th",
    "name": "Thai"
  },
  {
    "code": "bo",
    "name": "Tibetan"
  },
  {
    "code": "ti",
    "name": "Tigrinya"
  },
  {
    "code": "to",
    "name": "Tongan"
  },
  {
    "code": "ts",
    "name": "Tsonga"
  },
  {
    "code": "tn",
    "name": "Tswana"
  },
  {
    "code": "tr",
    "name": "Turkish"
  },
  {
    "code": "tk",
    "name": "Turkmen"
  },
  {
    "code": "uk",
    "name": "Ukrainian"
  },
  {
    "code": "ur",
    "name": "Urdu"
  },
  {
    "code": "ug",
    "name": "Uyghur"
  },
  {
    "code": "uz",
    "name": "Uzbek"
  },
  {
    "code": "ve",
    "name": "Venda"
  },
  {
    "code": "vi",
    "name": "Vietnamese"
  },
  {
    "code": "vo",
    "name": "Volapük"
  },
  {
    "code": "wa",
    "name": "Walloon"
  },
  {
    "code": "cy",
    "name": "Welsh"
  },
  {
    "code": "fy",
    "name": "Western Frisian"
  },
  {
    "code": "wo",
    "name": "Wolof"
  },
  {
    "code": "xh",
    "name": "Xhosa"
  },
  {
    "code": "yi",
    "name": "Yiddish"
  },
  {
    "code": "yo",
    "name": "Yoruba"
  },
  {
    "code": "za",
    "name": "Zhuang"
  },
  {
    "code": "zu",
    "name": "Zulu"
  }
];

const HUMAN_TAGS = [
  'Original lyrics',
  'Lead vocals performed',
  'Backing vocals',
  'Played an instrument',
  'Melody written',
  'Arrangement',
  'Prompt authorship',
  'Mixed by a person',
  'Mastered by a person',
];

function fillSelect(select, items, getValue, getLabel) {
  if (!select || !items) return;
  var seen = {};
  var i;
  var existing = select.querySelectorAll ? select.querySelectorAll('option') : (select.options || []);
  for (i = existing.length - 1; i >= 0; i -= 1) {
    if (existing[i].value && existing[i].parentNode) existing[i].parentNode.removeChild(existing[i]);
  }
  items.forEach(function (item) {
    var value = getValue(item);
    var label = getLabel(item);
    if (!value || seen[value]) return;
    seen[value] = true;
    var opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  });
}

function bindTypeahead(select, items, getValue, getLabel) {
  if (!select || !items || !items.length) return;
  if (select.getAttribute('data-typeahead') === 'on') return;
  var field = select.parentNode;
  if (!field) return;
  select.setAttribute('data-typeahead', 'on');
  field.classList.add('typeahead-field');

  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'typeahead-input';
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('spellcheck', 'false');
  input.id = select.id ? select.id + '-type' : '';
  input.setAttribute('placeholder', select.options[0] && !select.options[0].value ? select.options[0].textContent : 'Select');
  select.classList.add('is-typeahead-source');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  var list = document.createElement('div');
  list.className = 'typeahead-list is-hidden';
  list.setAttribute('role', 'listbox');

  if (select.id) {
    var label = field.querySelector('label[for="' + select.id + '"]');
    if (label && input.id) label.setAttribute('for', input.id);
  }

  field.insertBefore(input, select);
  field.appendChild(list);

  function exact(query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return null;
    var i;
    for (i = 0; i < items.length; i += 1) {
      var value = getValue(items[i]);
      var labelText = getLabel(items[i]);
      if (String(value).toLowerCase() === q || String(labelText).toLowerCase() === q) {
        return { value: value, label: labelText };
      }
    }
    return null;
  }

  function currentPick() {
    var value = String(select.value || '');
    if (!value) return null;
    var i;
    for (i = 0; i < items.length; i += 1) {
      if (String(getValue(items[i])) === value) {
        return { value: getValue(items[i]), label: getLabel(items[i]) };
      }
    }
    return null;
  }

  function syncFromSelect() {
    var pick = currentPick();
    if (pick) input.value = pick.label;
  }

  function applyPick(pick) {
    select.value = pick ? pick.value : '';
    input.value = pick ? pick.label : String(input.value || '').trim();
    if (!pick) select.selectedIndex = 0;
    if (typeof select.dispatchEvent === 'function') {
      try { select.dispatchEvent(new Event('change', { bubbles: true })); } catch (err) {}
    }
  }

  function hideList() {
    list.classList.add('is-hidden');
    list.innerHTML = '';
  }

  function showMatches(query) {
    var q = String(query || '').trim().toLowerCase();
    var matches = [];
    var starts = [];
    var i;
    for (i = 0; i < items.length; i += 1) {
      var value = getValue(items[i]);
      var labelText = getLabel(items[i]);
      var labelLow = String(labelText).toLowerCase();
      var valueLow = String(value).toLowerCase();
      if (!q || labelLow.indexOf(q) !== -1 || valueLow.indexOf(q) !== -1) {
        var row = { value: value, label: labelText };
        if (q && (labelLow.indexOf(q) === 0 || valueLow.indexOf(q) === 0)) starts.push(row);
        else matches.push(row);
      }
    }
    matches = starts.concat(matches);
    list.innerHTML = '';
    if (!matches.length) {
      hideList();
      return;
    }
    matches.forEach(function (pick) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = pick.label;
      btn.setAttribute('role', 'option');
      btn.addEventListener('mousedown', function (event) {
        event.preventDefault();
        applyPick(pick);
        hideList();
      });
      list.appendChild(btn);
    });
    list.classList.remove('is-hidden');
    list.style.maxHeight = '240px';
    list.style.overflowY = 'auto';
    list.style.overflowX = 'hidden';
  }

  list.addEventListener('wheel', function (event) {
    if (list.scrollHeight > list.clientHeight) event.stopPropagation();
  }, { passive: true });

  input.addEventListener('input', function () {
    var pick = exact(input.value);
    applyPick(pick);
    showMatches(input.value);
  });
  input.addEventListener('focus', function () {
    showMatches(input.value);
  });
  input.addEventListener('blur', function () {
    window.setTimeout(function () {
      hideList();
      var pick = exact(input.value);
      if (pick) applyPick(pick);
      else {
        select.value = '';
        input.value = '';
        if (select.options[0]) select.selectedIndex = 0;
      }
    }, 120);
  });
  if (select.addEventListener) select.addEventListener('change', syncFromSelect);
  syncFromSelect();
}

function syncTypeahead(select) {
  if (!select) return;
  var field = select.parentNode;
  if (!field || !field.querySelector) return;
  var input = field.querySelector('.typeahead-input');
  if (!input) return;
  var opt = select.options && select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
  if (opt && opt.value) input.value = opt.textContent || opt.label || '';
  else if (!select.value) input.value = '';
}

function fillUploadSelects(doc) {
  var root = doc || document;
  var genre = root.getElementById('tg-genre') || root.getElementById('edit-genre');
  var language = root.getElementById('tg-language') || root.getElementById('edit-language');
  fillSelect(root.getElementById('tg-genre'), GENRES, function (name) { return name; }, function (name) { return name; });
  fillSelect(root.getElementById('edit-genre'), GENRES, function (name) { return name; }, function (name) { return name; });
  fillSelect(root.getElementById('tg-language'), LANGUAGES, function (row) { return row.code; }, function (row) { return row.name; });
  fillSelect(root.getElementById('edit-language'), LANGUAGES, function (row) { return row.code; }, function (row) { return row.name; });
  bindTypeahead(root.getElementById('tg-genre'), GENRES, function (name) { return name; }, function (name) { return name; });
  bindTypeahead(root.getElementById('edit-genre'), GENRES, function (name) { return name; }, function (name) { return name; });
  bindTypeahead(root.getElementById('tg-language'), LANGUAGES, function (row) { return row.code; }, function (row) { return row.name; });
  bindTypeahead(root.getElementById('edit-language'), LANGUAGES, function (row) { return row.code; }, function (row) { return row.name; });
  fillSelect(root.getElementById('profile-genre'), GENRES, function (name) { return name; }, function (name) { return name; });
  bindTypeahead(root.getElementById('profile-genre'), GENRES, function (name) { return name; }, function (name) { return name; });
  return { genre: genre, language: language };
}

const api = { GENRES: GENRES, LANGUAGES: LANGUAGES, HUMAN_TAGS: HUMAN_TAGS, fillUploadSelects: fillUploadSelects, bindTypeahead: bindTypeahead, syncTypeahead: syncTypeahead };

if (typeof module === 'object' && module.exports) {
  module.exports = api;
} else if (typeof window !== 'undefined') {
  window.PlaigroundUploadCatalog = api;
  if (window.document && window.document.readyState === 'loading') {
    window.document.addEventListener('DOMContentLoaded', function () { fillUploadSelects(window.document); });
  } else if (window.document) {
    fillUploadSelects(window.document);
  }
}
