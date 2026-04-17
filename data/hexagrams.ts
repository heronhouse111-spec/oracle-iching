export interface Hexagram {
  number: number;
  nameZh: string;
  nameEn: string;
  character: string; // Unicode hexagram character
  upperTrigram: string;
  lowerTrigram: string;
  lines: number[]; // 6 lines from bottom to top: 1=yang, 0=yin
  judgmentZh: string;
  judgmentEn: string;
  imageZh: string;
  imageEn: string;
  judgmentVernacularZh: string; // 卦辭白話翻譯
  imageVernacularZh: string;   // 象辭白話翻譯
}

// Trigram names mapping
export const trigramNames: Record<string, { zh: string; en: string; symbol: string }> = {
  "111": { zh: "乾（天）", en: "Qian (Heaven)", symbol: "☰" },
  "000": { zh: "坤（地）", en: "Kun (Earth)", symbol: "☷" },
  "100": { zh: "震（雷）", en: "Zhen (Thunder)", symbol: "☳" },
  "010": { zh: "坎（水）", en: "Kan (Water)", symbol: "☵" },
  "001": { zh: "艮（山）", en: "Gen (Mountain)", symbol: "☶" },
  "011": { zh: "巽（風）", en: "Xun (Wind)", symbol: "☴" },
  "101": { zh: "離（火）", en: "Li (Fire)", symbol: "☲" },
  "110": { zh: "兌（澤）", en: "Dui (Lake)", symbol: "☱" },
};

// Full 64 hexagrams data
export const hexagrams: Hexagram[] = [
  {
    number: 1, nameZh: "乾", nameEn: "Qian (The Creative)", character: "䷀",
    upperTrigram: "111", lowerTrigram: "111", lines: [1,1,1,1,1,1],
    judgmentZh: "乾：元，亨，利，貞。", judgmentEn: "The Creative works sublime success, furthering through perseverance.",
    imageZh: "天行健，君子以自強不息。", imageEn: "Heaven in its motion gives the image of strength. The superior man makes himself strong and untiring.",
    judgmentVernacularZh: "萬物之始，大為亨通，適宜守正道。", imageVernacularZh: "天道剛健運行不息，君子應效法天道，自強不息地努力。",
  },
  {
    number: 2, nameZh: "坤", nameEn: "Kun (The Receptive)", character: "䷁",
    upperTrigram: "000", lowerTrigram: "000", lines: [0,0,0,0,0,0],
    judgmentZh: "坤：元，亨，利牝馬之貞。", judgmentEn: "The Receptive brings about sublime success, furthering through the perseverance of a mare.",
    imageZh: "地勢坤，君子以厚德載物。", imageEn: "The earth's condition is receptive devotion. The superior man who has breadth of character carries the outer world.",
    judgmentVernacularZh: "大為亨通，如母馬般柔順守正則吉利。", imageVernacularZh: "大地厚重包容，君子應效法大地，以深厚的品德承載萬物。",
  },
  {
    number: 3, nameZh: "屯", nameEn: "Zhun (Difficulty at the Beginning)", character: "䷂",
    upperTrigram: "010", lowerTrigram: "100", lines: [1,0,0,0,1,0],
    judgmentZh: "屯：元，亨，利，貞，勿用，有攸往，利建侯。", judgmentEn: "Difficulty at the Beginning works supreme success, furthering through perseverance.",
    imageZh: "雲，雷，屯；君子以經綸。", imageEn: "Clouds and thunder: the image of Difficulty at the Beginning.",
    judgmentVernacularZh: "萬事起頭難，但終將亨通。宜守正道，不宜輕舉妄動，適合建立根基。", imageVernacularZh: "雲雷匯聚預示新生，君子應在混亂中理出頭緒，建立秩序。",
  },
  {
    number: 4, nameZh: "蒙", nameEn: "Meng (Youthful Folly)", character: "䷃",
    upperTrigram: "001", lowerTrigram: "010", lines: [0,1,0,1,0,0],
    judgmentZh: "蒙：亨。匪我求童蒙，童蒙求我。", judgmentEn: "Youthful Folly has success. It is not I who seek the young fool; the young fool seeks me.",
    imageZh: "山下出泉，蒙；君子以果行育德。", imageEn: "A spring wells up at the foot of the mountain: the image of Youth.",
    judgmentVernacularZh: "亨通。不是我去求蒙昧之人，而是蒙昧之人來求教於我。", imageVernacularZh: "山下湧出泉水，象徵啟蒙教育。君子應果斷行事，培養品德。",
  },
  {
    number: 5, nameZh: "需", nameEn: "Xu (Waiting)", character: "䷄",
    upperTrigram: "010", lowerTrigram: "111", lines: [1,1,1,0,1,0],
    judgmentZh: "需：有孚，光亨，貞吉。利涉大川。", judgmentEn: "Waiting. If you are sincere, you have light and success. Perseverance brings good fortune.",
    imageZh: "雲上於天，需；君子以飲食宴樂。", imageEn: "Clouds rise up to heaven: the image of Waiting.",
    judgmentVernacularZh: "心懷誠信，前途光明亨通，守正則吉。適合渡過大的困難。", imageVernacularZh: "雲氣升上天空等待降雨，君子應安然等待，享受生活。",
  },
  {
    number: 6, nameZh: "訟", nameEn: "Song (Conflict)", character: "䷅",
    upperTrigram: "111", lowerTrigram: "010", lines: [0,1,0,1,1,1],
    judgmentZh: "訟：有孚，窒。惕中吉。終凶。", judgmentEn: "Conflict. You are sincere and are being obstructed. A cautious halt halfway brings good fortune.",
    imageZh: "天與水違行，訟；君子以作事謀始。", imageEn: "Heaven and water go their opposite ways: the image of Conflict.",
    judgmentVernacularZh: "雖有誠信，卻受到阻礙。保持警惕適可而止則吉，爭到底則凶。", imageVernacularZh: "天水相違背而行，君子做事應謀劃在先，避免爭端。",
  },
  {
    number: 7, nameZh: "師", nameEn: "Shi (The Army)", character: "䷆",
    upperTrigram: "000", lowerTrigram: "010", lines: [0,1,0,0,0,0],
    judgmentZh: "師：貞，丈人，吉無咎。", judgmentEn: "The Army. Perseverance and a strong man bring good fortune and no blame.",
    imageZh: "地中有水，師；君子以容民畜眾。", imageEn: "In the middle of the earth is water: the image of the Army.",
    judgmentVernacularZh: "守正道，由德高望重之人統率，則吉利無過失。", imageVernacularZh: "地中蘊藏著水，象徵蓄養兵力。君子應包容百姓，蓄養人才。",
  },
  {
    number: 8, nameZh: "比", nameEn: "Bi (Holding Together)", character: "䷇",
    upperTrigram: "010", lowerTrigram: "000", lines: [0,0,0,0,1,0],
    judgmentZh: "比：吉。原筮元永貞，無咎。", judgmentEn: "Holding Together brings good fortune. Inquire of the oracle once again whether you possess sublimity, constancy, and perseverance.",
    imageZh: "地上有水，比；先王以建萬國，親諸侯。", imageEn: "On the earth is water: the image of Holding Together.",
    judgmentVernacularZh: "吉利。反覆占問是否具備長久守正的條件，若有則無過失。", imageVernacularZh: "地上有水相親相近，古代君王以此建立邦國，親近諸侯。",
  },
  {
    number: 9, nameZh: "小畜", nameEn: "Xiao Xu (Small Taming)", character: "䷈",
    upperTrigram: "011", lowerTrigram: "111", lines: [1,1,1,0,1,1],
    judgmentZh: "小畜：亨。密雲不雨，自我西郊。", judgmentEn: "The Taming Power of the Small has success. Dense clouds, no rain from our western region.",
    imageZh: "風行天上，小畜；君子以懿文德。", imageEn: "The wind drives across heaven: the image of the Taming Power of the Small.",
    judgmentVernacularZh: "亨通。密雲從西方飄來，但尚未降雨。", imageVernacularZh: "風行天上，小有蓄積。君子應修養文德。",
  },
  {
    number: 10, nameZh: "履", nameEn: "Lü (Treading)", character: "䷉",
    upperTrigram: "111", lowerTrigram: "110", lines: [0,1,1,1,1,1],
    judgmentZh: "履虎尾，不咥人，亨。", judgmentEn: "Treading upon the tail of the tiger. It does not bite the man. Success.",
    imageZh: "上天下澤，履；君子以辨上下，定民志。", imageEn: "Heaven above, the lake below: the image of Treading.",
    judgmentVernacularZh: "踩到老虎尾巴，老虎沒有咬人，亨通。", imageVernacularZh: "天在上澤在下，各安其位。君子應明辨上下之禮，安定民心。",
  },
  {
    number: 11, nameZh: "泰", nameEn: "Tai (Peace)", character: "䷊",
    upperTrigram: "000", lowerTrigram: "111", lines: [1,1,1,0,0,0],
    judgmentZh: "泰：小往大來，吉亨。", judgmentEn: "Peace. The small departs, the great approaches. Good fortune. Success.",
    imageZh: "天地交，泰；后以財成天地之道。", imageEn: "Heaven and earth unite: the image of Peace.",
    judgmentVernacularZh: "小的去大的來，吉利亨通。", imageVernacularZh: "天地之氣交融，萬物通泰。君子應順應天道，輔助萬物成長。",
  },
  {
    number: 12, nameZh: "否", nameEn: "Pi (Standstill)", character: "䷋",
    upperTrigram: "111", lowerTrigram: "000", lines: [0,0,0,1,1,1],
    judgmentZh: "否之匪人，不利君子貞，大往小來。", judgmentEn: "Standstill. Evil people do not further the perseverance of the superior man. The great departs; the small approaches.",
    imageZh: "天地不交，否；君子以儉德辟難。", imageEn: "Heaven and earth do not unite: the image of Standstill.",
    judgmentVernacularZh: "閉塞不通，不利於君子守正。大的去小的來。", imageVernacularZh: "天地之氣不交，萬物不通。君子應節儉修德，以避開災難。",
  },
  {
    number: 13, nameZh: "同人", nameEn: "Tong Ren (Fellowship)", character: "䷌",
    upperTrigram: "111", lowerTrigram: "101", lines: [1,0,1,1,1,1],
    judgmentZh: "同人于野，亨。利涉大川，利君子貞。", judgmentEn: "Fellowship with Men in the open. Success. It furthers one to cross the great water.",
    imageZh: "天與火，同人；君子以類族辨物。", imageEn: "Heaven together with fire: the image of Fellowship with Men.",
    judgmentVernacularZh: "在郊野與人同心，亨通。利於渡過大的困難，利於君子守正。", imageVernacularZh: "天與火同性向上，象徵志同道合。君子應分析事物的異同。",
  },
  {
    number: 14, nameZh: "大有", nameEn: "Da You (Great Possession)", character: "䷍",
    upperTrigram: "101", lowerTrigram: "111", lines: [1,1,1,1,0,1],
    judgmentZh: "大有：元亨。", judgmentEn: "Possession in Great Measure. Supreme success.",
    imageZh: "火在天上，大有；君子以遏惡揚善。", imageEn: "Fire in heaven above: the image of Possession in Great Measure.",
    judgmentVernacularZh: "大為亨通。", imageVernacularZh: "火在天上，光明普照。君子應抑止邪惡，弘揚善行。",
  },
  {
    number: 15, nameZh: "謙", nameEn: "Qian (Modesty)", character: "䷎",
    upperTrigram: "000", lowerTrigram: "001", lines: [1,0,0,0,0,0],
    judgmentZh: "謙：亨，君子有終。", judgmentEn: "Modesty creates success. The superior man carries things through.",
    imageZh: "地中有山，謙；君子以裒多益寡。", imageEn: "Within the earth, a mountain: the image of Modesty.",
    judgmentVernacularZh: "亨通，謙虛的君子能有好的結果。", imageVernacularZh: "地中有山，外低內高。君子應減損多餘的，增益不足的。",
  },
  {
    number: 16, nameZh: "豫", nameEn: "Yu (Enthusiasm)", character: "䷏",
    upperTrigram: "100", lowerTrigram: "000", lines: [0,0,0,1,0,0],
    judgmentZh: "豫：利建侯行師。", judgmentEn: "Enthusiasm. It furthers one to install helpers and to set armies marching.",
    imageZh: "雷出地奮，豫；先王以作樂崇德。", imageEn: "Thunder comes resounding out of the earth: the image of Enthusiasm.",
    judgmentVernacularZh: "利於建立諸侯、出兵征戰。", imageVernacularZh: "雷從地中奮發而出，象徵振奮歡樂。古代君王以此制作音樂崇尚道德。",
  },
  {
    number: 17, nameZh: "隨", nameEn: "Sui (Following)", character: "䷐",
    upperTrigram: "110", lowerTrigram: "100", lines: [1,0,0,0,1,1],
    judgmentZh: "隨：元亨利貞，無咎。", judgmentEn: "Following has supreme success. Perseverance furthers. No blame.",
    imageZh: "澤中有雷，隨；君子以嚮晦入宴息。", imageEn: "Thunder in the middle of the lake: the image of Following.",
    judgmentVernacularZh: "大為亨通，利於守正，無過失。", imageVernacularZh: "澤中有雷，雷隨澤動。君子應日落而息，順應時勢。",
  },
  {
    number: 18, nameZh: "蠱", nameEn: "Gu (Work on the Decayed)", character: "䷑",
    upperTrigram: "001", lowerTrigram: "011", lines: [0,1,1,1,0,0],
    judgmentZh: "蠱：元亨，利涉大川。", judgmentEn: "Work on What Has Been Spoiled has supreme success.",
    imageZh: "山下有風，蠱；君子以振民育德。", imageEn: "The wind blows low on the mountain: the image of Decay.",
    judgmentVernacularZh: "大為亨通，利於渡過大的困難。", imageVernacularZh: "山下有風，風被山阻。君子應振奮民心，培育品德。",
  },
  {
    number: 19, nameZh: "臨", nameEn: "Lin (Approach)", character: "䷒",
    upperTrigram: "000", lowerTrigram: "110", lines: [0,1,1,0,0,0],
    judgmentZh: "臨：元亨利貞。至于八月有凶。", judgmentEn: "Approach has supreme success. Perseverance furthers. When the eighth month comes, there will be misfortune.",
    imageZh: "澤上有地，臨；君子以教思無窮。", imageEn: "The earth above the lake: the image of Approach.",
    judgmentVernacularZh: "大為亨通，利於守正。但到了八月可能有凶險。", imageVernacularZh: "澤上有地，地臨澤上。君子應用無窮的教化恩澤萬民。",
  },
  {
    number: 20, nameZh: "觀", nameEn: "Guan (Contemplation)", character: "䷓",
    upperTrigram: "011", lowerTrigram: "000", lines: [0,0,0,0,1,1],
    judgmentZh: "觀：盥而不薦，有孚顒若。", judgmentEn: "Contemplation. The ablution has been made, but not yet the offering. Full of trust they look up to him.",
    imageZh: "風行地上，觀；先王以省方觀民設教。", imageEn: "The wind blows over the earth: the image of Contemplation.",
    judgmentVernacularZh: "祭祀前已淨手但尚未獻祭，心懷虔誠仰望。", imageVernacularZh: "風行地上，周遊四方。古代君王以此巡視四方，觀察民情施行教化。",
  },
  {
    number: 21, nameZh: "噬嗑", nameEn: "Shi He (Biting Through)", character: "䷔",
    upperTrigram: "101", lowerTrigram: "100", lines: [1,0,0,1,0,1],
    judgmentZh: "噬嗑：亨。利用獄。", judgmentEn: "Biting Through has success. It is favorable to let justice be administered.",
    imageZh: "雷電，噬嗑；先王以明罰敕法。", imageEn: "Thunder and lightning: the image of Biting Through.",
    judgmentVernacularZh: "亨通。利於斷獄。", imageVernacularZh: "雷電交加，象徵威嚴的刑法。古代君王以此明確刑罰，整飭法度。",
  },
  {
    number: 22, nameZh: "賁", nameEn: "Bi (Grace)", character: "䷕",
    upperTrigram: "001", lowerTrigram: "101", lines: [1,0,1,1,0,0],
    judgmentZh: "賁：亨。小利有攸往。", judgmentEn: "Grace has success. In small matters it is favorable to undertake something.",
    imageZh: "山下有火，賁；君子以明庶政。", imageEn: "Fire at the foot of the mountain: the image of Grace.",
    judgmentVernacularZh: "亨通。小事有利。", imageVernacularZh: "山下有火，文飾山體。君子應明察政務，但不以文飾斷獄。",
  },
  {
    number: 23, nameZh: "剝", nameEn: "Bo (Splitting Apart)", character: "䷖",
    upperTrigram: "001", lowerTrigram: "000", lines: [0,0,0,1,0,0],
    judgmentZh: "剝：不利有攸往。", judgmentEn: "Splitting Apart. It does not further one to go anywhere.",
    imageZh: "山附於地，剝；上以厚下安宅。", imageEn: "The mountain rests on the earth: the image of Splitting Apart.",
    judgmentVernacularZh: "不利於有所行動。", imageVernacularZh: "山依附於地，逐漸剝落。在上者應厚待下民以安定根基。",
  },
  {
    number: 24, nameZh: "復", nameEn: "Fu (Return)", character: "䷗",
    upperTrigram: "000", lowerTrigram: "100", lines: [1,0,0,0,0,0],
    judgmentZh: "復：亨。出入無疾，朋來無咎。", judgmentEn: "Return. Success. Going out and coming in without error. Friends come without blame.",
    imageZh: "雷在地中，復；先王以至日閉關。", imageEn: "Thunder within the earth: the image of the Turning Point.",
    judgmentVernacularZh: "亨通。出入無災病，朋友來而無過失。", imageVernacularZh: "雷在地中蟄伏，象徵一陽復始。古代君王在冬至日關閉關隘休養生息。",
  },
  {
    number: 25, nameZh: "無妄", nameEn: "Wu Wang (Innocence)", character: "䷘",
    upperTrigram: "111", lowerTrigram: "100", lines: [1,0,0,1,1,1],
    judgmentZh: "無妄：元亨利貞。", judgmentEn: "Innocence. Supreme success. Perseverance furthers.",
    imageZh: "天下雷行，物與無妄。", imageEn: "Under heaven thunder rolls: all things attain the natural state of innocence.",
    judgmentVernacularZh: "大為亨通，利於守正。", imageVernacularZh: "天下雷動，萬物都處於自然無妄的狀態。",
  },
  {
    number: 26, nameZh: "大畜", nameEn: "Da Xu (Great Taming)", character: "䷙",
    upperTrigram: "001", lowerTrigram: "111", lines: [1,1,1,1,0,0],
    judgmentZh: "大畜：利貞，不家食吉，利涉大川。", judgmentEn: "The Taming Power of the Great. Perseverance furthers. Not eating at home brings good fortune.",
    imageZh: "天在山中，大畜；君子以多識前言往行。", imageEn: "Heaven within the mountain: the image of the Taming Power of the Great.",
    judgmentVernacularZh: "利於守正。不在家中吃飯（出外任職）則吉，利於渡過大的困難。", imageVernacularZh: "天被蓄藏在山中，象徵大的蓄積。君子應多學習前人的言行。",
  },
  {
    number: 27, nameZh: "頤", nameEn: "Yi (Nourishment)", character: "䷚",
    upperTrigram: "001", lowerTrigram: "100", lines: [1,0,0,1,0,0],
    judgmentZh: "頤：貞吉。觀頤，自求口實。", judgmentEn: "The Corners of the Mouth. Perseverance brings good fortune. Pay heed to the providing of nourishment.",
    imageZh: "山下有雷，頤；君子以慎言語，節飲食。", imageEn: "At the foot of the mountain, thunder: the image of Providing Nourishment.",
    judgmentVernacularZh: "守正則吉。觀察養生之道，自己尋求口中之食。", imageVernacularZh: "山下有雷，象徵頤養。君子應謹慎言語，節制飲食。",
  },
  {
    number: 28, nameZh: "大過", nameEn: "Da Guo (Great Exceeding)", character: "䷛",
    upperTrigram: "110", lowerTrigram: "011", lines: [0,1,1,0,1,1],
    judgmentZh: "大過：棟橈，利有攸往，亨。", judgmentEn: "Preponderance of the Great. The ridgepole sags. It furthers one to have somewhere to go. Success.",
    imageZh: "澤滅木，大過；君子以獨立不懼。", imageEn: "The lake rises above the trees: the image of Preponderance of the Great.",
    judgmentVernacularZh: "棟梁彎曲，利於有所行動，亨通。", imageVernacularZh: "湖水淹沒樹木，事態危急。君子應獨立不懼，遠離世俗。",
  },
  {
    number: 29, nameZh: "坎", nameEn: "Kan (The Abysmal Water)", character: "䷜",
    upperTrigram: "010", lowerTrigram: "010", lines: [0,1,0,0,1,0],
    judgmentZh: "習坎：有孚，維心亨，行有尚。", judgmentEn: "The Abysmal repeated. If you are sincere, you have success in your heart, and whatever you do succeeds.",
    imageZh: "水洊至，習坎；君子以常德行，習教事。", imageEn: "Water flows on and reaches the goal: the image of the Abysmal repeated.",
    judgmentVernacularZh: "心懷誠信，則內心亨通，所行之事有功。", imageVernacularZh: "水流不斷到來，君子應保持美德，反覆學習教化。",
  },
  {
    number: 30, nameZh: "離", nameEn: "Li (The Clinging Fire)", character: "䷝",
    upperTrigram: "101", lowerTrigram: "101", lines: [1,0,1,1,0,1],
    judgmentZh: "離：利貞，亨。畜牝牛，吉。", judgmentEn: "The Clinging. Perseverance furthers. It brings success. Care of the cow brings good fortune.",
    imageZh: "明兩作，離；大人以繼明照于四方。", imageEn: "That which is bright rises twice: the image of Fire.",
    judgmentVernacularZh: "利於守正，亨通。畜養母牛，吉利。", imageVernacularZh: "光明接連升起，君子應將光明延續照耀四方。",
  },
  {
    number: 31, nameZh: "咸", nameEn: "Xian (Influence)", character: "䷞",
    upperTrigram: "110", lowerTrigram: "001", lines: [1,0,0,0,1,1],
    judgmentZh: "咸：亨，利貞，取女吉。", judgmentEn: "Influence. Success. Perseverance furthers. To take a maiden to wife brings good fortune.",
    imageZh: "山上有澤，咸；君子以虛受人。", imageEn: "A lake on the mountain: the image of Influence.",
    judgmentVernacularZh: "亨通，利於守正。娶女則吉。", imageVernacularZh: "山上有澤，滋潤萬物。君子應虛心接納他人。",
  },
  {
    number: 32, nameZh: "恆", nameEn: "Heng (Duration)", character: "䷟",
    upperTrigram: "100", lowerTrigram: "011", lines: [0,1,1,1,0,0],
    judgmentZh: "恆：亨，無咎，利貞，利有攸往。", judgmentEn: "Duration. Success. No blame. Perseverance furthers. It furthers one to have somewhere to go.",
    imageZh: "雷風，恆；君子以立不易方。", imageEn: "Thunder and wind: the image of Duration.",
    judgmentVernacularZh: "亨通，無過失，利於守正。利於有所行動。", imageVernacularZh: "雷風相隨，長久不變。君子應堅守正道，不改變方向。",
  },
  {
    number: 33, nameZh: "遯", nameEn: "Dun (Retreat)", character: "䷠",
    upperTrigram: "111", lowerTrigram: "001", lines: [1,0,0,1,1,1],
    judgmentZh: "遯：亨，小利貞。", judgmentEn: "Retreat. Success. In what is small, perseverance furthers.",
    imageZh: "天下有山，遯；君子以遠小人。", imageEn: "Mountain under heaven: the image of Retreat.",
    judgmentVernacularZh: "亨通，小事利於守正。", imageVernacularZh: "天下有山，象徵退隱。君子應遠離小人，保持威嚴。",
  },
  {
    number: 34, nameZh: "大壯", nameEn: "Da Zhuang (Great Power)", character: "䷡",
    upperTrigram: "100", lowerTrigram: "111", lines: [1,1,1,1,0,0],
    judgmentZh: "大壯：利貞。", judgmentEn: "The Power of the Great. Perseverance furthers.",
    imageZh: "雷在天上，大壯；君子以非禮弗履。", imageEn: "Thunder in heaven above: the image of the Power of the Great.",
    judgmentVernacularZh: "利於守正。", imageVernacularZh: "雷在天上，聲勢浩大。君子應以禮自律，不做違禮的事。",
  },
  {
    number: 35, nameZh: "晉", nameEn: "Jin (Progress)", character: "䷢",
    upperTrigram: "101", lowerTrigram: "000", lines: [0,0,0,1,0,1],
    judgmentZh: "晉：康侯用錫馬蕃庶，晝日三接。", judgmentEn: "Progress. The powerful prince is honored with horses in large numbers. In a single day he is granted audience three times.",
    imageZh: "明出地上，晉；君子以自昭明德。", imageEn: "The sun rises over the earth: the image of Progress.",
    judgmentVernacularZh: "賢明的侯爵獲賜良馬繁多，一天之內三次獲得接見。", imageVernacularZh: "太陽升出地面，光明普照。君子應自我彰顯美德。",
  },
  {
    number: 36, nameZh: "明夷", nameEn: "Ming Yi (Darkening of the Light)", character: "䷣",
    upperTrigram: "000", lowerTrigram: "101", lines: [1,0,1,0,0,0],
    judgmentZh: "明夷：利艱貞。", judgmentEn: "Darkening of the Light. In adversity it furthers one to be persevering.",
    imageZh: "明入地中，明夷；君子以莅眾，用晦而明。", imageEn: "The light has sunk into the earth: the image of Darkening of the Light.",
    judgmentVernacularZh: "在艱難中利於守正。", imageVernacularZh: "光明沒入地中，象徵光明受損。君子應收斂光芒，在昏暗中保持明智。",
  },
  {
    number: 37, nameZh: "家人", nameEn: "Jia Ren (The Family)", character: "䷤",
    upperTrigram: "011", lowerTrigram: "101", lines: [1,0,1,0,1,1],
    judgmentZh: "家人：利女貞。", judgmentEn: "The Family. The perseverance of the woman furthers.",
    imageZh: "風自火出，家人；君子以言有物而行有恆。", imageEn: "Wind comes forth from fire: the image of the Family.",
    judgmentVernacularZh: "利於女子守正。", imageVernacularZh: "風從火中吹出，由內而外。君子說話應有內容，行為應有恆心。",
  },
  {
    number: 38, nameZh: "睽", nameEn: "Kui (Opposition)", character: "䷥",
    upperTrigram: "101", lowerTrigram: "110", lines: [0,1,1,1,0,1],
    judgmentZh: "睽：小事吉。", judgmentEn: "Opposition. In small matters, good fortune.",
    imageZh: "上火下澤，睽；君子以同而異。", imageEn: "Above, fire; below, the lake: the image of Opposition.",
    judgmentVernacularZh: "小事吉利。", imageVernacularZh: "上火下澤，性質相違。君子應在求同中保留差異。",
  },
  {
    number: 39, nameZh: "蹇", nameEn: "Jian (Obstruction)", character: "䷦",
    upperTrigram: "010", lowerTrigram: "001", lines: [1,0,0,0,1,0],
    judgmentZh: "蹇：利西南，不利東北；利見大人，貞吉。", judgmentEn: "Obstruction. The southwest furthers. The northeast does not further. It furthers one to see the great man.",
    imageZh: "山上有水，蹇；君子以反身修德。", imageEn: "Water on the mountain: the image of Obstruction.",
    judgmentVernacularZh: "利於往西南方，不利於往東北方。利於見到大人物，守正則吉。", imageVernacularZh: "山上有水，道路艱險。君子應反躬自省，修養品德。",
  },
  {
    number: 40, nameZh: "解", nameEn: "Xie (Deliverance)", character: "䷧",
    upperTrigram: "100", lowerTrigram: "010", lines: [0,1,0,1,0,0],
    judgmentZh: "解：利西南，無所往。", judgmentEn: "Deliverance. The southwest furthers. If there is no longer anything where one has to go, return brings good fortune.",
    imageZh: "雷雨作，解；君子以赦過宥罪。", imageEn: "Thunder and rain set in: the image of Deliverance.",
    judgmentVernacularZh: "利於往西南方。如果已經沒有需要前往的地方，回來則吉。", imageVernacularZh: "雷雨大作，萬物舒解。君子應寬恕過錯，赦免罪行。",
  },
  {
    number: 41, nameZh: "損", nameEn: "Sun (Decrease)", character: "䷨",
    upperTrigram: "001", lowerTrigram: "110", lines: [0,1,1,1,0,0],
    judgmentZh: "損：有孚，元吉，無咎，可貞，利有攸往。", judgmentEn: "Decrease combined with sincerity brings about supreme good fortune without blame.",
    imageZh: "山下有澤，損；君子以懲忿窒慾。", imageEn: "At the foot of the mountain, the lake: the image of Decrease.",
    judgmentVernacularZh: "心懷誠信，大吉，無過失，可以守正，利於有所行動。", imageVernacularZh: "山下有澤，澤損山益。君子應克制忿怒，抑制慾望。",
  },
  {
    number: 42, nameZh: "益", nameEn: "Yi (Increase)", character: "䷩",
    upperTrigram: "011", lowerTrigram: "100", lines: [1,0,0,0,1,1],
    judgmentZh: "益：利有攸往，利涉大川。", judgmentEn: "Increase. It furthers one to undertake something. It furthers one to cross the great water.",
    imageZh: "風雷，益；君子以見善則遷，有過則改。", imageEn: "Wind and thunder: the image of Increase.",
    judgmentVernacularZh: "利於有所行動，利於渡過大的困難。", imageVernacularZh: "風雷交動，互相增益。君子見到善行就學習，有了過錯就改正。",
  },
  {
    number: 43, nameZh: "夬", nameEn: "Guai (Breakthrough)", character: "䷪",
    upperTrigram: "110", lowerTrigram: "111", lines: [1,1,1,0,1,1],
    judgmentZh: "夬：揚于王庭，孚號，有厲。", judgmentEn: "Breakthrough. One must resolutely make the matter known at the court of the king.",
    imageZh: "澤上於天，夬；君子以施祿及下。", imageEn: "The lake has risen up to heaven: the image of Breakthrough.",
    judgmentVernacularZh: "在朝廷上宣佈決定，以誠信號令眾人，但仍有危險。", imageVernacularZh: "湖水升上天空，象徵決斷。君子應施恩惠於下。",
  },
  {
    number: 44, nameZh: "姤", nameEn: "Gou (Coming to Meet)", character: "䷫",
    upperTrigram: "111", lowerTrigram: "011", lines: [0,1,1,1,1,1],
    judgmentZh: "姤：女壯，勿用取女。", judgmentEn: "Coming to Meet. The maiden is powerful. One should not marry such a maiden.",
    imageZh: "天下有風，姤；后以施命誥四方。", imageEn: "Under heaven, wind: the image of Coming to Meet.",
    judgmentVernacularZh: "女子強勢，不宜娶這樣的女子。", imageVernacularZh: "天下有風，風行天下。君子應發佈命令告示四方。",
  },
  {
    number: 45, nameZh: "萃", nameEn: "Cui (Gathering Together)", character: "䷬",
    upperTrigram: "110", lowerTrigram: "000", lines: [0,0,0,0,1,1],
    judgmentZh: "萃：亨。王假有廟，利見大人，亨，利貞。", judgmentEn: "Gathering Together. Success. The king approaches his temple. It furthers one to see the great man.",
    imageZh: "澤上於地，萃；君子以除戎器，戒不虞。", imageEn: "Over the earth, the lake: the image of Gathering Together.",
    judgmentVernacularZh: "亨通。君王來到宗廟祭祀，利於見大人物，亨通，利於守正。", imageVernacularZh: "澤在地上，萬物聚集。君子應整備武器，防備意外。",
  },
  {
    number: 46, nameZh: "升", nameEn: "Sheng (Pushing Upward)", character: "䷭",
    upperTrigram: "000", lowerTrigram: "011", lines: [0,1,1,0,0,0],
    judgmentZh: "升：元亨，用見大人，勿恤，南征吉。", judgmentEn: "Pushing Upward has supreme success. One must see the great man. Fear not. Departure toward the south brings good fortune.",
    imageZh: "地中生木，升；君子以順德，積小以高大。", imageEn: "Within the earth, wood grows: the image of Pushing Upward.",
    judgmentVernacularZh: "大為亨通。適宜去見大人物，不用擔憂。向南方前進則吉。", imageVernacularZh: "地中長出樹木，逐漸升高。君子應順應道德，積小成大。",
  },
  {
    number: 47, nameZh: "困", nameEn: "Kun (Oppression)", character: "䷮",
    upperTrigram: "110", lowerTrigram: "010", lines: [0,1,0,0,1,1],
    judgmentZh: "困：亨，貞，大人吉，無咎，有言不信。", judgmentEn: "Oppression. Success. Perseverance. The great man brings about good fortune. No blame.",
    imageZh: "澤無水，困；君子以致命遂志。", imageEn: "There is no water in the lake: the image of Exhaustion.",
    judgmentVernacularZh: "亨通，守正，大人物吉利，無過失。說話不被人相信。", imageVernacularZh: "澤中無水，困頓之象。君子應捨命以實現志向。",
  },
  {
    number: 48, nameZh: "井", nameEn: "Jing (The Well)", character: "䷯",
    upperTrigram: "010", lowerTrigram: "011", lines: [0,1,1,0,1,0],
    judgmentZh: "井：改邑不改井，無喪無得，往來井井。", judgmentEn: "The Well. The town may be changed, but the well cannot be changed. It neither decreases nor increases.",
    imageZh: "木上有水，井；君子以勞民勸相。", imageEn: "Water over wood: the image of the Well.",
    judgmentVernacularZh: "改變城邑但不能改變水井。水井不會減少也不會增多，來來往往都在井邊打水。", imageVernacularZh: "木上有水，汲水上來。君子應勞動為民，互相勸勉。",
  },
  {
    number: 49, nameZh: "革", nameEn: "Ge (Revolution)", character: "䷰",
    upperTrigram: "110", lowerTrigram: "101", lines: [1,0,1,0,1,1],
    judgmentZh: "革：己日乃孚，元亨利貞，悔亡。", judgmentEn: "Revolution. On your own day you are believed. Supreme success, furthering through perseverance. Remorse disappears.",
    imageZh: "澤中有火，革；君子以治曆明時。", imageEn: "Fire in the lake: the image of Revolution.",
    judgmentVernacularZh: "到了該變革的時候就會得到信任，大為亨通，利於守正，悔恨消除。", imageVernacularZh: "澤中有火，水火相息。君子應制定曆法，明確時令。",
  },
  {
    number: 50, nameZh: "鼎", nameEn: "Ding (The Caldron)", character: "䷱",
    upperTrigram: "101", lowerTrigram: "011", lines: [0,1,1,1,0,1],
    judgmentZh: "鼎：元吉，亨。", judgmentEn: "The Caldron. Supreme good fortune. Success.",
    imageZh: "木上有火，鼎；君子以正位凝命。", imageEn: "Fire over wood: the image of the Caldron.",
    judgmentVernacularZh: "大吉，亨通。", imageVernacularZh: "木上有火，烹飪食物。君子應端正自己的位置，領受天命。",
  },
  {
    number: 51, nameZh: "震", nameEn: "Zhen (The Arousing Thunder)", character: "䷲",
    upperTrigram: "100", lowerTrigram: "100", lines: [1,0,0,1,0,0],
    judgmentZh: "震：亨。震來虩虩，笑言啞啞。", judgmentEn: "The Arousing. Success. Shock comes—Loss! Oh! Then follow laughter—Ha! Ha!",
    imageZh: "洊雷，震；君子以恐懼修省。", imageEn: "Thunder repeated: the image of Shock.",
    judgmentVernacularZh: "亨通。雷聲到來令人驚恐，之後笑語盈盈。", imageVernacularZh: "接連的雷聲，震動不已。君子應心存敬畏，反省自身。",
  },
  {
    number: 52, nameZh: "艮", nameEn: "Gen (Keeping Still Mountain)", character: "䷳",
    upperTrigram: "001", lowerTrigram: "001", lines: [1,0,0,1,0,0],
    judgmentZh: "艮其背，不獲其身，行其庭，不見其人，無咎。", judgmentEn: "Keeping Still. Keeping his back still so that he no longer feels his body. He goes into his courtyard and does not see his people. No blame.",
    imageZh: "兼山，艮；君子以思不出其位。", imageEn: "Mountains standing close together: the image of Keeping Still.",
    judgmentVernacularZh: "保持背部靜止，感覺不到自身。走進庭院看不到人，無過失。", imageVernacularZh: "兩山並立，靜止不動。君子思考問題不超出自己的職位。",
  },
  {
    number: 53, nameZh: "漸", nameEn: "Jian (Development)", character: "䷴",
    upperTrigram: "011", lowerTrigram: "001", lines: [1,0,0,0,1,1],
    judgmentZh: "漸：女歸吉，利貞。", judgmentEn: "Development. The maiden is given in marriage. Good fortune. Perseverance furthers.",
    imageZh: "山上有木，漸；君子以居賢德善俗。", imageEn: "On the mountain, a tree: the image of Development.",
    judgmentVernacularZh: "女子出嫁吉利，利於守正。", imageVernacularZh: "山上有木，循序漸長。君子應修養賢德，改善風俗。",
  },
  {
    number: 54, nameZh: "歸妹", nameEn: "Gui Mei (The Marrying Maiden)", character: "䷵",
    upperTrigram: "100", lowerTrigram: "110", lines: [0,1,1,1,0,0],
    judgmentZh: "歸妹：征凶，無攸利。", judgmentEn: "The Marrying Maiden. Undertakings bring misfortune. Nothing that would further.",
    imageZh: "澤上有雷，歸妹；君子以永終知敝。", imageEn: "Thunder over the lake: the image of the Marrying Maiden.",
    judgmentVernacularZh: "前進則凶，沒有什麼有利的。", imageVernacularZh: "澤上有雷，雷動澤隨。君子應思慮長遠，知道事物的弊端。",
  },
  {
    number: 55, nameZh: "豐", nameEn: "Feng (Abundance)", character: "䷶",
    upperTrigram: "100", lowerTrigram: "101", lines: [1,0,1,1,0,0],
    judgmentZh: "豐：亨，王假之，勿憂，宜日中。", judgmentEn: "Abundance has success. The king attains abundance. Be not sad. Be like the sun at midday.",
    imageZh: "雷電皆至，豐；君子以折獄致刑。", imageEn: "Both thunder and lightning come: the image of Abundance.",
    judgmentVernacularZh: "亨通。君王達到豐盛，不必憂慮，應如日中天般行事。", imageVernacularZh: "雷電交至，光明豐盛。君子應斷獄判刑。",
  },
  {
    number: 56, nameZh: "旅", nameEn: "Lü (The Wanderer)", character: "䷷",
    upperTrigram: "101", lowerTrigram: "001", lines: [1,0,0,1,0,1],
    judgmentZh: "旅：小亨，旅貞吉。", judgmentEn: "The Wanderer. Success through smallness. Perseverance brings good fortune to the wanderer.",
    imageZh: "山上有火，旅；君子以明慎用刑。", imageEn: "Fire on the mountain: the image of the Wanderer.",
    judgmentVernacularZh: "小有亨通，旅途中守正則吉。", imageVernacularZh: "山上有火，不會久留。君子應明慎用刑，不滯留訟獄。",
  },
  {
    number: 57, nameZh: "巽", nameEn: "Xun (The Gentle Wind)", character: "䷸",
    upperTrigram: "011", lowerTrigram: "011", lines: [0,1,1,0,1,1],
    judgmentZh: "巽：小亨，利攸往，利見大人。", judgmentEn: "The Gentle. Success through what is small. It furthers one to have somewhere to go. It furthers one to see the great man.",
    imageZh: "隨風，巽；君子以申命行事。", imageEn: "Winds following one upon the other: the image of the Gently Penetrating.",
    judgmentVernacularZh: "小有亨通，利於有所行動。利於見到大人物。", imageVernacularZh: "風接連吹來，深入無阻。君子應反覆申明命令以推行事務。",
  },
  {
    number: 58, nameZh: "兌", nameEn: "Dui (The Joyous Lake)", character: "䷹",
    upperTrigram: "110", lowerTrigram: "110", lines: [0,1,1,0,1,1],
    judgmentZh: "兌：亨，利貞。", judgmentEn: "The Joyous. Success. Perseverance is favorable.",
    imageZh: "麗澤，兌；君子以朋友講習。", imageEn: "Lakes resting one on the other: the image of the Joyous.",
    judgmentVernacularZh: "亨通，利於守正。", imageVernacularZh: "兩澤相連，互相滋潤。君子應與朋友互相講習。",
  },
  {
    number: 59, nameZh: "渙", nameEn: "Huan (Dispersion)", character: "䷺",
    upperTrigram: "011", lowerTrigram: "010", lines: [0,1,0,0,1,1],
    judgmentZh: "渙：亨。王假有廟，利涉大川，利貞。", judgmentEn: "Dispersion. Success. The king approaches his temple. It furthers one to cross the great water.",
    imageZh: "風行水上，渙；先王以享于帝立廟。", imageEn: "The wind drives over the water: the image of Dispersion.",
    judgmentVernacularZh: "亨通。君王來到宗廟。利於渡過大的困難，利於守正。", imageVernacularZh: "風吹行水上，使水渙散。古代君王以此祭祀上帝，建立宗廟。",
  },
  {
    number: 60, nameZh: "節", nameEn: "Jie (Limitation)", character: "䷻",
    upperTrigram: "010", lowerTrigram: "110", lines: [0,1,1,0,1,0],
    judgmentZh: "節：亨。苦節不可貞。", judgmentEn: "Limitation. Success. Galling limitation must not be persevered in.",
    imageZh: "澤上有水，節；君子以制數度，議德行。", imageEn: "Water over lake: the image of Limitation.",
    judgmentVernacularZh: "亨通。過於苛刻的節制則不可長久。", imageVernacularZh: "澤上有水，適度蓄積。君子應制定法度，商議德行。",
  },
  {
    number: 61, nameZh: "中孚", nameEn: "Zhong Fu (Inner Truth)", character: "䷼",
    upperTrigram: "011", lowerTrigram: "110", lines: [0,1,1,0,1,1],
    judgmentZh: "中孚：豚魚吉，利涉大川，利貞。", judgmentEn: "Inner Truth. Pigs and fishes. Good fortune. It furthers one to cross the great water. Perseverance furthers.",
    imageZh: "澤上有風，中孚；君子以議獄緩死。", imageEn: "Wind over lake: the image of Inner Truth.",
    judgmentVernacularZh: "用豚魚獻祭則吉，利於渡過大的困難，利於守正。", imageVernacularZh: "澤上有風，風吹水動。君子應審議案件，緩和死刑。",
  },
  {
    number: 62, nameZh: "小過", nameEn: "Xiao Guo (Small Exceeding)", character: "䷽",
    upperTrigram: "100", lowerTrigram: "001", lines: [1,0,0,1,0,0],
    judgmentZh: "小過：亨，利貞，可小事，不可大事。", judgmentEn: "Preponderance of the Small. Success. Perseverance furthers. Small things may be done; great things should not be done.",
    imageZh: "山上有雷，小過；君子以行過乎恭。", imageEn: "Thunder on the mountain: the image of Preponderance of the Small.",
    judgmentVernacularZh: "亨通，利於守正。可以做小事，不可以做大事。", imageVernacularZh: "山上有雷，過於響亮。君子行為應過於恭敬，居喪應過於悲哀。",
  },
  {
    number: 63, nameZh: "既濟", nameEn: "Ji Ji (After Completion)", character: "䷾",
    upperTrigram: "010", lowerTrigram: "101", lines: [1,0,1,0,1,0],
    judgmentZh: "既濟：亨，小利貞，初吉終亂。", judgmentEn: "After Completion. Success in small matters. Perseverance furthers. At the beginning good fortune; at the end disorder.",
    imageZh: "水在火上，既濟；君子以思患而預防之。", imageEn: "Water over fire: the image of the condition in After Completion.",
    judgmentVernacularZh: "亨通，小事有利於守正。起初吉利，最終會有混亂。", imageVernacularZh: "水在火上，已經完成。君子應思考禍患而提前預防。",
  },
  {
    number: 64, nameZh: "未濟", nameEn: "Wei Ji (Before Completion)", character: "䷿",
    upperTrigram: "101", lowerTrigram: "010", lines: [0,1,0,1,0,1],
    judgmentZh: "未濟：亨，小狐汔濟，濡其尾，無攸利。", judgmentEn: "Before Completion. Success. But if the little fox, after nearly completing the crossing, gets his tail in the water, there is nothing that would further.",
    imageZh: "火在水上，未濟；君子以慎辨物居方。", imageEn: "Fire over water: the image of the condition before transition.",
    judgmentVernacularZh: "亨通。小狐狸快要渡過河時，卻弄濕了尾巴，沒有什麼有利的。", imageVernacularZh: "火在水上，尚未完成。君子應謹慎辨別事物，各居其位。",
  },
];

/**
 * King Wen sequence lookup table.
 * Key: "upperTrigram,lowerTrigram" where each trigram is 3 binary digits.
 * Trigram encoding (bottom to top): 111=乾, 000=坤, 100=震, 010=坎, 001=艮, 011=巽, 101=離, 110=兌
 */
const kingWenTable: Record<string, number> = {
  "111,111": 1, "000,000": 2, "010,100": 3, "001,010": 4,
  "010,111": 5, "111,010": 6, "000,010": 7, "010,000": 8,
  "011,111": 9, "111,110": 10, "000,111": 11, "111,000": 12,
  "111,101": 13, "101,111": 14, "000,001": 15, "100,000": 16,
  "110,100": 17, "001,011": 18, "000,110": 19, "011,000": 20,
  "101,100": 21, "001,101": 22, "001,000": 23, "000,100": 24,
  "111,100": 25, "001,111": 26, "001,100": 27, "110,011": 28,
  "010,010": 29, "101,101": 30, "110,001": 31, "100,011": 32,
  "111,001": 33, "100,111": 34, "101,000": 35, "000,101": 36,
  "011,101": 37, "101,110": 38, "010,001": 39, "100,010": 40,
  "001,110": 41, "011,100": 42, "110,111": 43, "111,011": 44,
  "110,000": 45, "000,011": 46, "110,010": 47, "010,011": 48,
  "110,101": 49, "101,011": 50, "100,100": 51, "001,001": 52,
  "011,001": 53, "100,110": 54, "100,101": 55, "101,001": 56,
  "011,011": 57, "110,110": 58, "011,010": 59, "010,110": 60,
  "011,110": 61, "100,001": 62, "010,101": 63, "101,010": 64,
};

// Look up hexagram by its six lines (from bottom to top, each 0 or 1)
export function findHexagram(lines: number[]): Hexagram | undefined {
  // Lower trigram = lines 0-2, upper trigram = lines 3-5
  const lower = `${lines[0]}${lines[1]}${lines[2]}`;
  const upper = `${lines[3]}${lines[4]}${lines[5]}`;
  const num = kingWenTable[`${upper},${lower}`];
  if (num) return hexagrams.find((h) => h.number === num);
  // Fallback: try line-by-line match
  return hexagrams.find((h) => h.lines.every((l, i) => l === lines[i]));
}

// Look up hexagram by King Wen number (1-64)
export function getHexagramByNumber(num: number): Hexagram | undefined {
  return hexagrams.find((h) => h.number === num);
}
