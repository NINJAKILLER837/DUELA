export interface NameCulture {
  nationality: string;
  weight: number;
  first: string[];
  last: string[];
  cities: string[];
  pathways: string[];
}

export const NAME_CULTURES: NameCulture[] = [
  {
    nationality: "Estados Unidos", weight: 42,
    first: ["Marcus", "Darius", "Jalen", "Tyler", "Cameron", "Andre", "Malik", "Isaiah", "Devin", "Trevor", "Jordan", "Kendrick", "Elijah", "Grant", "Micah", "Caleb", "Xavier", "Trent", "Desmond", "Julian", "Bryce", "Amir", "Cole", "Nolan", "Rashad", "Donovan", "Keegan", "Miles", "Jaylen", "Owen"],
    last: ["Bennett", "Holloway", "Reed", "Whitaker", "Monroe", "Barlow", "Ellison", "Crawford", "Haywood", "Brooks", "Simmons", "Porter", "Mercer", "Landry", "Vaughn", "Dawson", "Pierce", "Calloway", "Foster", "Hampton", "Sullivan", "Winters", "Banks", "Chambers", "Lawson", "Price", "Sterling", "Dixon", "Norris", "Maddox"],
    cities: ["Chicago", "Atlanta", "Houston", "Filadelfia", "Detroit", "Los Ángeles", "Charlotte", "Memphis", "Baltimore", "Oakland", "Cleveland", "San Antonio"],
    pathways: ["Universidad de Ridgeport", "Academia Lakeview", "Sierra State", "Northgate College", "Instituto Bellhaven", "Eastline Prep", "Universidad de Fairmont", "Costa Atlantic University"],
  },
  {
    nationality: "Canadá", weight: 6,
    first: ["Lucas", "Noah", "Émile", "Mason", "Kieran", "Tobias", "Carter", "Jayden", "Owen", "Liam"],
    last: ["Bélanger", "Morrow", "Sinclair", "Vachon", "Fraser", "Colborne", "Tremblay", "Beaumont", "Hollis", "Gagnon"],
    cities: ["Toronto", "Montreal", "Vancouver", "Ottawa", "Brampton", "Halifax"],
    pathways: ["Academia Northline", "Universidad de Laurent", "Cégep de Mont-Royal", "Pacific Coast Prep"],
  },
  {
    nationality: "Francia", weight: 6,
    first: ["Théo", "Lucas", "Mateo", "Enzo", "Nolan", "Élie", "Yanis", "Maxence", "Ilan", "Sacha"],
    last: ["Moreau", "Delcourt", "Lemaire", "Baptiste", "Rousseau", "Vasseur", "Lefebvre", "Girard", "Marchand", "Dupont"],
    cities: ["París", "Lyon", "Marsella", "Burdeos", "Nantes", "Lille"],
    pathways: ["Centre Orange Academy", "Institut Sportif de l'Ouest", "Universidad de Lyon", "Pôle Elite Paris"],
  },
  {
    nationality: "Serbia", weight: 3,
    first: ["Nikola", "Luka", "Vuk", "Stefan", "Miloš", "Dušan", "Aleksa", "Filip", "Petar", "Nemanja"],
    last: ["Milić", "Jovanović", "Stanković", "Vuković", "Pavlović", "Marković", "Đorđević", "Todorović", "Ilić", "Ristić"],
    cities: ["Belgrado", "Novi Sad", "Niš", "Kragujevac"],
    pathways: ["Academia Partizan", "Escuela Estrella Roja", "Universidad de Belgrado", "Centro Novi Sad"],
  },
  {
    nationality: "España", weight: 4,
    first: ["Álvaro", "Diego", "Hugo", "Sergio", "Iván", "Adrián", "Pau", "Marc", "Bruno", "Iker"],
    last: ["Navarro", "Serrano", "Molina", "Carrasco", "Iglesias", "Ortega", "Vidal", "Solano", "Campos", "Ferrer"],
    cities: ["Madrid", "Barcelona", "Valencia", "Sevilla", "Bilbao", "Zaragoza"],
    pathways: ["Cantera Estudiantes", "Academia del Mediterráneo", "Universidad de Valencia", "Centro Siglo XXI"],
  },
  {
    nationality: "Alemania", weight: 3,
    first: ["Jonas", "Lennart", "Felix", "Niko", "Elias", "Moritz", "Tom", "Ben", "Finn", "Henrik"],
    last: ["Weber", "Krüger", "Hoffmann", "Neumann", "Vogel", "Schreiber", "Braun", "Keller", "Brandt", "Fischer"],
    cities: ["Berlín", "Múnich", "Hamburgo", "Colonia", "Leipzig"],
    pathways: ["Academia Alba", "Centro Bayern", "Universidad de Colonia", "North German Institute"],
  },
  {
    nationality: "Australia", weight: 4,
    first: ["Jack", "Aiden", "Lachlan", "Riley", "Hunter", "Beau", "Cooper", "Noah", "Tyson", "Callum"],
    last: ["Hargrave", "Kingsley", "Brennan", "Whitfield", "Sutherland", "Colvin", "Rutledge", "Dalton", "McCabe", "Hollis"],
    cities: ["Sídney", "Melbourne", "Brisbane", "Perth", "Adelaida"],
    pathways: ["NBA Global Academy", "Instituto de Canberra", "Victoria College", "Academia Perth"],
  },
  {
    nationality: "Nigeria", weight: 3,
    first: ["Chidi", "Tunde", "Emeka", "Ayo", "Kelechi", "Ifeanyi", "Obinna", "Sade", "Lekan", "Uche"],
    last: ["Adeyemi", "Okonkwo", "Mensah", "Balogun", "Eze", "Adebayo", "Nwosu", "Okafor", "Adeleke", "Ibe"],
    cities: ["Lagos", "Abuya", "Port Harcourt", "Ibadan"],
    pathways: ["Academia Lagos Hoops", "NBA Africa Academy", "Universidad de Abuya", "Centro Lagos Norte"],
  },
  {
    nationality: "Brasil", weight: 3,
    first: ["Gabriel", "Matheus", "Lucas", "Rafael", "Caio", "Felipe", "João", "Murilo", "Vitor", "Igor"],
    last: ["Almeida", "Barbosa", "Costa", "Nogueira", "Ribeiro", "Souza", "Teixeira", "Ferreira", "Cardoso", "Andrade"],
    cities: ["São Paulo", "Río de Janeiro", "Belo Horizonte", "Curitiba", "Salvador"],
    pathways: ["Centro Paulista", "Academia Carioca", "Universidad de Minas", "Instituto Sul Basketball"],
  },
  {
    nationality: "Lituania", weight: 2,
    first: ["Matas", "Rokas", "Dovis", "Augustas", "Lukas", "Nojus", "Tadas", "Ignas", "Kasparas", "Arnas"],
    last: ["Brazdeikis", "Stankevičius", "Petraitis", "Vaitkus", "Mažeika", "Jankauskas", "Kazlauskas", "Butkus", "Šimkus", "Grigas"],
    cities: ["Kaunas", "Vilna", "Klaipeda", "Šiauliai"],
    pathways: ["Escuela Zalgiris", "Academia Vilnius", "Universidad de Kaunas", "Centro Báltico"],
  },
  {
    nationality: "Turquía", weight: 2,
    first: ["Kerem", "Emir", "Arda", "Cenk", "Bora", "Efe", "Mert", "Kaan", "Onur", "Ege"],
    last: ["Yılmaz", "Demir", "Kaya", "Aydın", "Şahin", "Koç", "Arslan", "Çelik", "Ekinci", "Turan"],
    cities: ["Estambul", "Ankara", "Esmirna", "Bursa"],
    pathways: ["Academia Anadolu", "Universidad de Estambul", "Centro Efes", "Bosforo Basketball"],
  },
  {
    nationality: "Argentina", weight: 2,
    first: ["Nicolás", "Santino", "Franco", "Joaquín", "Tomás", "Bautista", "Lautaro", "Facundo", "Ignacio", "Valentín"],
    last: ["Acosta", "Bianchi", "Coronel", "Ferreyra", "Quinteros", "Molina", "Sosa", "Peralta", "Villalba", "Cardozo"],
    cities: ["Buenos Aires", "Córdoba", "Rosario", "Bahía Blanca"],
    pathways: ["Academia Oeste", "Universidad de Córdoba", "Centro Rosarino", "Cantera del Plata"],
  },
  {
    nationality: "Croacia", weight: 2,
    first: ["Ivan", "Luka", "Marko", "Ante", "Stipe", "Josip", "Karlo", "Matej", "Dario", "Roko"],
    last: ["Kovačić", "Marić", "Perić", "Babić", "Novak", "Tomić", "Jurić", "Vukić", "Bošnjak", "Šarić"],
    cities: ["Zagreb", "Split", "Zadar", "Rijeka"],
    pathways: ["Academia Split", "Universidad de Zagreb", "Centro Adriático", "Escuela Zadar"],
  },
  {
    nationality: "Japón", weight: 1,
    first: ["Ren", "Haruto", "Sota", "Kaito", "Yuto", "Riku", "Daiki", "Takumi", "Kenji", "Hiro"],
    last: ["Aoki", "Fujimoto", "Hasegawa", "Ishikawa", "Kobayashi", "Matsuda", "Nakamura", "Okada", "Sasaki", "Takeda"],
    cities: ["Tokio", "Osaka", "Yokohama", "Nagoya"],
    pathways: ["Academia B.League", "Universidad de Tokio", "Centro Yokohama", "Pacific Rising Prep"],
  },
  {
    nationality: "Eslovenia", weight: 2,
    first: ["Luka", "Jan", "Marko", "Miha", "Žiga", "Gašper", "Rok", "Jaka", "Nace", "Tilen"],
    last: ["Novak", "Kovač", "Zupan", "Kralj", "Vidmar", "Potočnik", "Kos", "Hribar", "Bevc", "Mlakar"],
    cities: ["Liubliana", "Maribor", "Celje", "Koper"],
    pathways: ["Academia Olimpija", "Universidad de Liubliana", "Centro Adriático", "Escuela Celje"],
  },
  {
    nationality: "RD del Congo", weight: 2,
    first: ["Moïse", "Josué", "Bilal", "Emmanuel", "Gédéon", "Nathan", "Cédric", "Elie", "Jonathan", "Patrick"],
    last: ["Mbala", "Kabasele", "Ilunga", "Mutombo", "Ngoy", "Tshibangu", "Mukendi", "Kasongo", "Luyindula", "Bemba"],
    cities: ["Kinsasa", "Lubumbashi", "Goma", "Bukavu"],
    pathways: ["Academia Kinshasa", "NBA Africa Academy", "Centro Lubumbashi", "Universidad de Goma"],
  },
];

export const NATIONALITIES = NAME_CULTURES.map((culture) => culture.nationality);
