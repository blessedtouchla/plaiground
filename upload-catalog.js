/**
 * Upload form catalogs.
 *
 * Genres: the store documents one canonical list. Public OpenAPI has no genre
 * enum and no subgenre field. This list is the complete public Apple Music
 * (iTunes) Music genre tree plus the store's documented example strings
 * Afrobeats and Afropop.
 *
 * Subgenre is not added: create/update bodies only document genre.
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
    "name": "Twi"
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

function identity(item) {
  return item;
}

function languageValue(row) {
  return row && row.code;
}

function languageLabel(row) {
  return row && row.name;
}

function itemsForSelect(select) {
  var id = select && select.id;
  if (id === 'tg-language' || id === 'edit-language') return LANGUAGES;
  if (id === 'tg-genre' || id === 'edit-genre' || id === 'profile-genre' || !id) return GENRES;
  return GENRES;
}

function gettersForSelect(select) {
  var id = select && select.id;
  if (id === 'tg-language' || id === 'edit-language') {
    return { getValue: languageValue, getLabel: languageLabel };
  }
  return { getValue: identity, getLabel: identity };
}

function optionList(select) {
  if (!select) return [];
  if (select.querySelectorAll) return Array.prototype.slice.call(select.querySelectorAll('option'));
  return Array.prototype.slice.call(select.options || []);
}

function ensureOption(select, value, label) {
  if (!select || !value) return;
  var existing = optionList(select);
  var i;
  for (i = 0; i < existing.length; i += 1) {
    if (String(existing[i].value) === String(value)) return;
  }
  var opt = document.createElement('option');
  opt.value = value;
  opt.textContent = label || value;
  if (typeof select.appendChild === 'function') select.appendChild(opt);
  else if (select.options && typeof select.options.push === 'function') select.options.push(opt);
}

function findPick(items, getValue, getLabel, raw) {
  var q = String(raw || '').trim();
  if (!q || !items || !items.length) return null;
  var i;
  var value;
  var label;
  for (i = 0; i < items.length; i += 1) {
    value = getValue(items[i]);
    label = getLabel(items[i]);
    if (String(value) === q || String(label) === q) return { value: value, label: label };
  }
  var low = q.toLowerCase();
  for (i = 0; i < items.length; i += 1) {
    value = getValue(items[i]);
    label = getLabel(items[i]);
    if (String(value).toLowerCase() === low || String(label).toLowerCase() === low) {
      return { value: value, label: label };
    }
  }
  for (i = 0; i < items.length; i += 1) {
    value = getValue(items[i]);
    label = getLabel(items[i]);
    if (String(label).toLowerCase().indexOf(low) === 0 || String(value).toLowerCase().indexOf(low) === 0) {
      return { value: value, label: label };
    }
  }
  return null;
}

function typeaheadInput(select) {
  var field = select && select.parentNode;
  if (!field) return null;
  var input = field.querySelector && field.querySelector('.typeahead-input');
  if (input && input.className && String(input.className).indexOf('typeahead-input') !== -1) return input;
  if (field.children && field.children.length) {
    var i;
    for (i = 0; i < field.children.length; i += 1) {
      if (field.children[i] && String(field.children[i].className || '').indexOf('typeahead-input') !== -1) {
        return field.children[i];
      }
    }
  }
  return null;
}

function fillSelect(select, items, getValue, getLabel) {
  if (!select || !items) return;
  var current = String(select.value || '');
  var seen = {};
  var i;
  var existing = optionList(select);
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
  if (current) {
    var pick = findPick(items, getValue, getLabel, current);
    if (pick) select.value = pick.value;
    else {
      ensureOption(select, current, current);
      select.value = current;
    }
  }
}

var TYPEAHEAD_LIST_CAP = 24;
var typeaheadApplying = false;

function isTypeaheadBound(select) {
  return !!(select && select.getAttribute && select.getAttribute('data-typeahead') === 'on' && typeaheadInput(select));
}

function bindTypeahead(select, items, getValue, getLabel) {
  if (!select || !items || !items.length) return;
  var field = select.parentNode;
  if (!field) return;
  var existingInput = typeaheadInput(select);
  if (select.getAttribute('data-typeahead') === 'on' && existingInput) return;
  if (existingInput && existingInput.parentNode && existingInput.parentNode.removeChild) {
    existingInput.parentNode.removeChild(existingInput);
  }
  var existingList = field.querySelector && field.querySelector('.typeahead-list');
  if (existingList && String(existingList.className || '').indexOf('typeahead-list') === -1) existingList = null;
  if (!existingList && field.children) {
    var i;
    for (i = 0; i < field.children.length; i += 1) {
      if (field.children[i] && String(field.children[i].className || '').indexOf('typeahead-list') !== -1) {
        existingList = field.children[i];
        break;
      }
    }
  }
  if (existingList && existingList.parentNode && existingList.parentNode.removeChild) {
    existingList.parentNode.removeChild(existingList);
  }
  if (select.removeAttribute) select.removeAttribute('data-typeahead');
  select.setAttribute('data-typeahead', 'on');
  field.classList.add('typeahead-field');

  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'typeahead-input';
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('autocapitalize', 'none');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('inputmode', 'search');
  input.setAttribute('enterkeyhint', 'done');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.id = select.id ? select.id + '-type' : '';
  input.setAttribute('placeholder', select.options[0] && !select.options[0].value ? select.options[0].textContent : 'Select');
  select.classList.add('is-typeahead-source');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  var list = document.createElement('div');
  list.className = 'typeahead-list is-hidden';
  list.id = input.id ? input.id + '-list' : '';
  list.setAttribute('role', 'listbox');
  if (list.id) input.setAttribute('aria-controls', list.id);

  if (select.id) {
    var label = field.querySelector('label[for="' + select.id + '"]');
    if (label && input.id) label.setAttribute('for', input.id);
  }

  field.insertBefore(input, select);
  field.appendChild(list);

  var picking = false;
  var placeTimer = 0;
  var win = typeof window !== 'undefined' ? window : null;

  function exact(query) {
    return findPick(items, getValue, getLabel, query);
  }

  function currentPick() {
    var value = String(select.value || '');
    if (!value) return null;
    return findPick(items, getValue, getLabel, value) || { value: value, label: value };
  }

  function syncFromSelect() {
    var pick = currentPick();
    var active = typeof document !== 'undefined' && document.activeElement === input;
    if (pick) input.value = pick.label;
    else if (!active) input.value = '';
  }

  function applyPick(pick) {
    typeaheadApplying = true;
    try {
      if (pick && pick.value) {
        ensureOption(select, pick.value, pick.label);
        select.value = pick.value;
        input.value = pick.label;
      } else {
        select.value = '';
        if (select.options[0]) select.selectedIndex = 0;
      }
      if (typeof select.dispatchEvent === 'function') {
        try { select.dispatchEvent(new Event('change', { bubbles: true })); } catch (err) {}
      }
    } finally {
      typeaheadApplying = false;
    }
  }

  function typedMatch(query) {
    var pick = exact(query);
    if (!pick) {
      applyPick(null);
      return null;
    }
    var typed = String(query || '').trim().toLowerCase();
    var labelLow = String(pick.label || '').toLowerCase();
    // Autofill the visible field only on a real label. ISO codes like "en"
    // must not jump the input to "English" while the user is still typing.
    if (typed && typed === labelLow) applyPick(pick);
    else {
      select.value = '';
      if (select.options[0]) select.selectedIndex = 0;
    }
    return pick;
  }

  function viewportBox() {
    var vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (vv && typeof vv.height === 'number') {
      return {
        top: vv.offsetTop || 0,
        left: vv.offsetLeft || 0,
        width: vv.width,
        height: vv.height,
      };
    }
    var height = (typeof window !== 'undefined' && window.innerHeight) || 0;
    var width = (typeof window !== 'undefined' && window.innerWidth) || 0;
    return { top: 0, left: 0, width: width, height: height };
  }

  function keepInputVisible() {
    if (!input.getBoundingClientRect) return;
    var rect = input.getBoundingClientRect();
    var box = viewportBox();
    if (!box.height || !rect || typeof rect.top !== 'number') return;
    var desired = box.top + Math.min(88, Math.max(12, Math.round(box.height * 0.14)));
    var delta = rect.top - desired;
    if (Math.abs(delta) > 10 && typeof window !== 'undefined' && window.scrollBy) {
      window.scrollBy(0, delta);
    }
  }

  function placeList() {
    if (!list.classList || list.classList.contains('is-hidden')) return;
    var maxH = 240;
    var above = false;
    if (input.getBoundingClientRect) {
      var rect = input.getBoundingClientRect();
      var box = viewportBox();
      if (rect && typeof rect.bottom === 'number' && box.height) {
        var spaceBelow = box.top + box.height - rect.bottom - 8;
        var spaceAbove = rect.top - box.top - 8;
        above = spaceBelow < 140 && spaceAbove > spaceBelow;
        maxH = Math.max(120, Math.min(240, above ? spaceAbove : (spaceBelow > 0 ? spaceBelow : 240)));
      }
    }
    if (list.classList.toggle) list.classList.toggle('is-above', above);
    list.style.top = above ? 'auto' : 'calc(100% + 4px)';
    list.style.bottom = above ? 'calc(100% + 4px)' : 'auto';
    list.style.maxHeight = maxH + 'px';
    list.style.overflowY = 'auto';
    list.style.overflowX = 'hidden';
  }

  function hideList() {
    list.classList.add('is-hidden');
    if (list.classList.remove) list.classList.remove('is-above');
    list.innerHTML = '';
    list.style.top = '';
    list.style.bottom = '';
    if (field.classList && field.classList.remove) field.classList.remove('is-typeahead-open');
    input.setAttribute('aria-expanded', 'false');
  }

  function pickFromNode(node) {
    if (!node || !node.getAttribute) return null;
    var value = node.getAttribute('data-value');
    if (value == null || value === '') return null;
    return { value: value, label: node.textContent || value };
  }

  function pickOption(pick, event) {
    if (event && event.preventDefault) event.preventDefault();
    if (event && event.stopPropagation) event.stopPropagation();
    if (picking) return;
    picking = true;
    applyPick(pick);
    hideList();
    if (input.blur) input.blur();
    if (win && win.setTimeout) win.setTimeout(function () { picking = false; }, 450);
    else picking = false;
  }

  function commitListEvent(event) {
    var node = event && event.target;
    while (node && node !== list) {
      var pick = pickFromNode(node);
      if (pick) {
        pickOption(pick, event);
        return true;
      }
      node = node.parentNode;
    }
    return false;
  }

  function showMatches(query) {
    if (picking) return;
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
    if (matches.length > TYPEAHEAD_LIST_CAP) matches = matches.slice(0, TYPEAHEAD_LIST_CAP);
    list.innerHTML = '';
    if (!matches.length) {
      hideList();
      return;
    }
    if (!q) {
      var hint = document.createElement('div');
      hint.className = 'typeahead-hint';
      hint.setAttribute('role', 'note');
      hint.textContent = 'Type to search';
      list.appendChild(hint);
    }
    matches.forEach(function (pick) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = pick.label;
      btn.setAttribute('role', 'option');
      btn.setAttribute('data-value', pick.value);
      btn.setAttribute('tabindex', '-1');
      list.appendChild(btn);
    });
    list.classList.remove('is-hidden');
    if (field.classList && field.classList.add) field.classList.add('is-typeahead-open');
    input.setAttribute('aria-expanded', 'true');
    placeList();
  }

  if (list.addEventListener) {
    list.addEventListener('pointerdown', commitListEvent, true);
    list.addEventListener('click', commitListEvent);
  }
  list.addEventListener('wheel', function (event) {
    if (list.scrollHeight > list.clientHeight) event.stopPropagation();
  }, { passive: true });
  list.addEventListener('touchstart', function (event) {
    if (event && event.stopPropagation) event.stopPropagation();
  }, { passive: true });

  function openList() {
    showMatches(input.value);
    keepInputVisible();
    if (win && win.setTimeout) {
      if (placeTimer && win.clearTimeout) win.clearTimeout(placeTimer);
      placeTimer = win.setTimeout(function () {
        keepInputVisible();
        placeList();
      }, 280);
    }
  }

  input.addEventListener('input', function () {
    typedMatch(input.value);
    showMatches(input.value);
  });
  input.addEventListener('focus', openList);
  input.addEventListener('click', openList);
  input.addEventListener('pointerup', openList);
  input.addEventListener('keydown', function (event) {
    var key = event && event.key;
    if (key !== 'Enter' && key !== 'ArrowDown') return;
    var first = list.querySelector && list.querySelector('button');
    if (!first) {
      showMatches(input.value);
      first = list.querySelector && list.querySelector('button');
    }
    if (!first) return;
    if (event.preventDefault) event.preventDefault();
    pickOption({ value: first.getAttribute('data-value') || first.textContent, label: first.textContent }, event);
  });
  input.addEventListener('blur', function () {
    function finishBlur() {
      if (picking) return;
      hideList();
      var pick = exact(input.value);
      if (pick) applyPick(pick);
      else {
        select.value = '';
        input.value = '';
        if (select.options[0]) select.selectedIndex = 0;
      }
    }
    if (win && win.setTimeout) win.setTimeout(finishBlur, 400);
    else finishBlur();
  });
  function onViewport() {
    if (list.classList.contains('is-hidden')) return;
    placeList();
  }
  if (win) {
    if (win.visualViewport && win.visualViewport.addEventListener) {
      win.visualViewport.addEventListener('resize', onViewport);
      win.visualViewport.addEventListener('scroll', onViewport);
    }
    if (win.addEventListener) win.addEventListener('resize', onViewport);
  }
  if (select.addEventListener) {
    select.addEventListener('change', syncFromSelect);
    select.addEventListener('focus', function () {
      if (input && input.focus) input.focus();
    });
    select.addEventListener('mousedown', function (event) {
      if (event && event.preventDefault) event.preventDefault();
      if (input && input.focus) input.focus();
      openList();
    });
  }
  select._plaigroundSyncTypeahead = syncFromSelect;
  syncFromSelect();
}

function syncTypeahead(select) {
  if (!select) return;
  if (typeof select._plaigroundSyncTypeahead === 'function') {
    select._plaigroundSyncTypeahead();
    return;
  }
  var input = typeaheadInput(select);
  if (!input) return;
  var opt = select.options && select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
  if (opt && opt.value) input.value = opt.textContent || opt.label || opt.value;
  else if (select.value) input.value = select.value;
  else input.value = '';
}

function setTypeaheadValue(select, raw) {
  if (!select) return '';
  var spec = gettersForSelect(select);
  var items = itemsForSelect(select);
  var value = String(raw || '').trim();
  if (!value) {
    select.value = '';
    if (select.options && select.options[0]) select.selectedIndex = 0;
    syncTypeahead(select);
    return '';
  }
  var pick = findPick(items, spec.getValue, spec.getLabel, value) || { value: value, label: value };
  ensureOption(select, pick.value, pick.label);
  select.value = pick.value;
  syncTypeahead(select);
  return pick.value;
}

function canonicalCatalogValue(select, raw) {
  if (!select) return null;
  var spec = gettersForSelect(select);
  var pick = findPick(itemsForSelect(select), spec.getValue, spec.getLabel, raw);
  if (!String(raw || '').trim()) return '';
  return pick ? pick.value : null;
}

function fillOneSelect(select, items, getValue, getLabel) {
  if (!select) return;
  if (isTypeaheadBound(select)) return;
  fillSelect(select, items, getValue, getLabel);
  try {
    bindTypeahead(select, items, getValue, getLabel);
  } catch (err) {}
}

function fillUploadSelects(doc) {
  var root = doc || document;
  if (!root || typeof root.getElementById !== 'function') return { genre: null, language: null };
  var genre = root.getElementById('tg-genre') || root.getElementById('edit-genre');
  var language = root.getElementById('tg-language') || root.getElementById('edit-language');
  if (typeaheadApplying) return { genre: genre, language: language };
  fillOneSelect(root.getElementById('tg-genre'), GENRES, identity, identity);
  fillOneSelect(root.getElementById('edit-genre'), GENRES, identity, identity);
  fillOneSelect(root.getElementById('tg-language'), LANGUAGES, languageValue, languageLabel);
  fillOneSelect(root.getElementById('edit-language'), LANGUAGES, languageValue, languageLabel);
  fillOneSelect(root.getElementById('profile-genre'), GENRES, identity, identity);
  return { genre: genre, language: language };
}

const catalogApi = {
  GENRES: GENRES,
  LANGUAGES: LANGUAGES,
  HUMAN_TAGS: HUMAN_TAGS,
  TYPEAHEAD_LIST_CAP: TYPEAHEAD_LIST_CAP,
  fillUploadSelects: fillUploadSelects,
  bindTypeahead: bindTypeahead,
  syncTypeahead: syncTypeahead,
  setTypeaheadValue: setTypeaheadValue,
  canonicalCatalogValue: canonicalCatalogValue,
};

if (typeof module === 'object' && module.exports) {
  module.exports = catalogApi;
}
if (typeof window !== 'undefined') {
  window.PlaigroundUploadCatalog = catalogApi;
  function bootCatalog() {
    try { fillUploadSelects(window.document); } catch (err) {}
  }
  if (window.document && window.document.readyState === 'loading') {
    window.document.addEventListener('DOMContentLoaded', bootCatalog);
  } else if (window.document) {
    bootCatalog();
  }
}
