/**
 * 問題靈感題庫 — 給 step="question" textarea 下方的 picker 用
 *
 * 結構:Record<categoryId, InspirationGroup[]>
 *   - categoryId 對齊 lib/divination.ts 的 questionCategories(love / career / wealth / health / study / general)
 *   - 每個 category 下有多個分組,每組包多句問句
 *   - ja / ko 缺值時前端 fallback 到 en
 */

export interface InspirationQuestion {
  zh: string;
  en: string;
  ja?: string;
  ko?: string;
}

export interface InspirationGroup {
  titleZh: string;
  titleEn: string;
  titleJa?: string;
  titleKo?: string;
  questions: InspirationQuestion[];
}

export const QUESTION_INSPIRATIONS: Record<string, InspirationGroup[]> = {
  // ───────── 愛情類 ─────────
  love: [
    {
      titleZh: "情感狀態與發展",
      titleEn: "Relationship Status",
      titleJa: "関係の状態と進展",
      titleKo: "관계 상태와 발전",
      questions: [
        {
          zh: "他/她對我的真實想法是什麼?",
          en: "What does he/she really think of me?",
          ja: "彼/彼女は私のことを本当はどう思っている?",
          ko: "그/그녀는 나를 진심으로 어떻게 생각하나요?",
        },
        {
          zh: "我們目前的關係走向如何?",
          en: "Where is our current relationship heading?",
          ja: "私たちの今の関係はどこへ向かう?",
          ko: "우리 관계는 어디로 향하고 있나요?",
        },
        {
          zh: "對方對我的感情是真心的嗎?",
          en: "Are their feelings for me genuine?",
          ja: "相手の気持ちは本気?",
          ko: "상대의 마음은 진심인가요?",
        },
      ],
    },
    {
      titleZh: "吸引桃花與脫單",
      titleEn: "Attracting Love",
      titleJa: "ご縁を引き寄せる",
      titleKo: "인연 끌어당기기",
      questions: [
        {
          zh: "如何吸引我的正緣 / 桃花?",
          en: "How can I attract my soulmate?",
          ja: "どうすれば運命の相手を引き寄せられる?",
          ko: "어떻게 인연을 끌어당길 수 있나요?",
        },
        {
          zh: "我何時會脫單?",
          en: "When will I find love?",
          ja: "いつ恋人ができる?",
          ko: "언제 솔로에서 벗어날까요?",
        },
        {
          zh: "近期會遇到新的戀愛對象嗎?",
          en: "Will I meet someone new soon?",
          ja: "近いうちに新しい出会いはある?",
          ko: "곧 새로운 인연이 찾아올까요?",
        },
      ],
    },
    {
      titleZh: "前任關係與復合",
      titleEn: "Ex & Reconciliation",
      titleJa: "元恋人と復縁",
      titleKo: "전 연인과 재결합",
      questions: [
        {
          zh: "我們會復合嗎?",
          en: "Will we get back together?",
          ja: "私たちは復縁する?",
          ko: "우리는 재결합할까요?",
        },
        {
          zh: "他/她還想跟我復合嗎?",
          en: "Do they still want to reconcile?",
          ja: "相手はまだ復縁を望んでいる?",
          ko: "그/그녀는 아직 재결합을 원하나요?",
        },
        {
          zh: "我該放下這段感情嗎?",
          en: "Should I let go of this relationship?",
          ja: "この恋を手放すべき?",
          ko: "이 사랑을 놓아주어야 할까요?",
        },
      ],
    },
    {
      titleZh: "正緣與靈魂伴侶",
      titleEn: "Soulmate",
      titleJa: "運命の相手",
      titleKo: "운명의 상대",
      questions: [
        {
          zh: "我的正緣會以什麼方式出現?",
          en: "How will my soulmate appear?",
          ja: "運命の相手はどう現れる?",
          ko: "인연은 어떤 모습으로 나타날까요?",
        },
        {
          zh: "我的靈魂伴侶有什麼特徵?",
          en: "What traits will my soulmate have?",
          ja: "ソウルメイトの特徴は?",
          ko: "소울메이트는 어떤 특징을 가질까요?",
        },
      ],
    },
    {
      titleZh: "感情危機與挑戰",
      titleEn: "Conflict & Challenges",
      titleJa: "関係の危機",
      titleKo: "감정 위기와 도전",
      questions: [
        {
          zh: "我們之間出現了什麼問題?",
          en: "What's going wrong between us?",
          ja: "私たちの間に何が起きている?",
          ko: "우리 사이에 무슨 일이 있나요?",
        },
        {
          zh: "如何修補目前的感情裂痕?",
          en: "How can we mend our relationship?",
          ja: "今の関係をどう修復する?",
          ko: "지금의 관계를 어떻게 회복할까요?",
        },
      ],
    },
    {
      titleZh: "婚姻與伴侶關係",
      titleEn: "Marriage",
      titleJa: "結婚とパートナーシップ",
      titleKo: "결혼과 동반자 관계",
      questions: [
        {
          zh: "我何時會結婚?",
          en: "When will I get married?",
          ja: "いつ結婚する?",
          ko: "언제 결혼하게 될까요?",
        },
        {
          zh: "我和現在的對象適合走入婚姻嗎?",
          en: "Are we compatible for marriage?",
          ja: "今の相手と結婚すべき?",
          ko: "지금의 상대와 결혼이 어울릴까요?",
        },
      ],
    },
  ],

  // ───────── 事業類 ─────────
  career: [
    {
      titleZh: "工作運勢與發展",
      titleEn: "Career Outlook",
      titleJa: "仕事運と発展",
      titleKo: "직장운과 발전",
      questions: [
        {
          zh: "近期我的事業運如何?",
          en: "What's my career outlook?",
          ja: "最近の仕事運は?",
          ko: "최근 나의 직장운은 어떤가요?",
        },
        {
          zh: "我目前的工作適合我嗎?",
          en: "Is my current job right for me?",
          ja: "今の仕事は私に合っている?",
          ko: "지금의 직장은 나와 맞나요?",
        },
        {
          zh: "主管 / 老闆對我的真實看法?",
          en: "What does my boss truly think of me?",
          ja: "上司は私を本当はどう見ている?",
          ko: "상사는 나를 진심으로 어떻게 보나요?",
        },
      ],
    },
    {
      titleZh: "轉職與跳槽",
      titleEn: "Job Change",
      titleJa: "転職",
      titleKo: "이직",
      questions: [
        {
          zh: "我該不該換工作?",
          en: "Should I switch jobs?",
          ja: "転職すべき?",
          ko: "이직해야 할까요?",
        },
        {
          zh: "現在是離職的好時機嗎?",
          en: "Is now a good time to quit?",
          ja: "退職するなら今?",
          ko: "지금이 퇴사의 적기인가요?",
        },
        {
          zh: "新的工作機會值得接受嗎?",
          en: "Should I accept the new offer?",
          ja: "新しい仕事を受けるべき?",
          ko: "새 일자리를 받아들여야 할까요?",
        },
      ],
    },
    {
      titleZh: "創業與副業",
      titleEn: "Entrepreneurship",
      titleJa: "起業と副業",
      titleKo: "창업과 부업",
      questions: [
        {
          zh: "我適合創業嗎?",
          en: "Am I cut out for entrepreneurship?",
          ja: "私は起業に向いている?",
          ko: "나는 창업에 적합한가요?",
        },
        {
          zh: "我的創業 / 副業會成功嗎?",
          en: "Will my venture succeed?",
          ja: "私の事業は成功する?",
          ko: "내 사업/부업은 성공할까요?",
        },
      ],
    },
    {
      titleZh: "職場關係",
      titleEn: "Workplace Relationships",
      titleJa: "職場の人間関係",
      titleKo: "직장 인간관계",
      questions: [
        {
          zh: "同事 / 主管的關係如何改善?",
          en: "How can I improve workplace relationships?",
          ja: "職場の関係をどう改善する?",
          ko: "직장 관계를 어떻게 개선할 수 있나요?",
        },
        {
          zh: "職場上會出現貴人嗎?",
          en: "Will I find a mentor at work?",
          ja: "仕事で恩人が現れる?",
          ko: "직장에서 귀인이 나타날까요?",
        },
      ],
    },
    {
      titleZh: "重大決策",
      titleEn: "Big Decisions",
      titleJa: "重要な決断",
      titleKo: "중요한 결정",
      questions: [
        {
          zh: "該不該接下這個專案 / 責任?",
          en: "Should I take on this project?",
          ja: "このプロジェクトを引き受けるべき?",
          ko: "이 프로젝트/책임을 맡아야 할까요?",
        },
        {
          zh: "我的下一步該往哪走?",
          en: "Where should I head next?",
          ja: "次のステップはどこへ?",
          ko: "다음 발걸음은 어디로?",
        },
      ],
    },
  ],

  // ───────── 財運類 ─────────
  wealth: [
    {
      titleZh: "整體財運",
      titleEn: "Overall Wealth",
      titleJa: "全体的な金運",
      titleKo: "전체 재물운",
      questions: [
        {
          zh: "近期我的整體財運如何?",
          en: "What's my overall wealth outlook?",
          ja: "最近の金運は?",
          ko: "최근 재물운은 어떤가요?",
        },
        {
          zh: "接下來半年的財運走勢?",
          en: "Wealth trend for the next 6 months?",
          ja: "今後半年の金運の流れは?",
          ko: "앞으로 반년의 재물 흐름은?",
        },
      ],
    },
    {
      titleZh: "投資與理財",
      titleEn: "Investment",
      titleJa: "投資と資産運用",
      titleKo: "투자와 자산 관리",
      questions: [
        {
          zh: "目前的投資值得繼續嗎?",
          en: "Should I keep my current investments?",
          ja: "今の投資は続けるべき?",
          ko: "지금의 투자를 계속해야 할까요?",
        },
        {
          zh: "適合我的理財方向是?",
          en: "What's my best wealth strategy?",
          ja: "私に合う資産運用は?",
          ko: "나에게 맞는 재테크는?",
        },
        {
          zh: "這筆投資會獲利嗎?",
          en: "Will this investment pay off?",
          ja: "この投資は利益になる?",
          ko: "이 투자는 수익을 낼까요?",
        },
      ],
    },
    {
      titleZh: "收入機會",
      titleEn: "Income Opportunities",
      titleJa: "収入の機会",
      titleKo: "수입 기회",
      questions: [
        {
          zh: "何時會有加薪 / 獎金?",
          en: "When will I get a raise or bonus?",
          ja: "昇給やボーナスはいつ?",
          ko: "급여 인상이나 보너스는 언제?",
        },
        {
          zh: "是否會有意外之財?",
          en: "Will I receive unexpected money?",
          ja: "思わぬ収入はある?",
          ko: "의외의 수입이 있을까요?",
        },
      ],
    },
    {
      titleZh: "重大支出",
      titleEn: "Major Expenses",
      titleJa: "大きな支出",
      titleKo: "큰 지출",
      questions: [
        {
          zh: "該不該買房 / 買車?",
          en: "Should I buy a house or car?",
          ja: "家や車を買うべき?",
          ko: "집이나 차를 사야 할까요?",
        },
        {
          zh: "該借錢給對方嗎?",
          en: "Should I lend money to them?",
          ja: "お金を貸すべき?",
          ko: "그 사람에게 돈을 빌려줘야 할까요?",
        },
      ],
    },
    {
      titleZh: "財務壓力",
      titleEn: "Financial Pressure",
      titleJa: "経済的なストレス",
      titleKo: "재정 압박",
      questions: [
        {
          zh: "何時能擺脫目前的財務困境?",
          en: "When will I escape financial trouble?",
          ja: "いつ経済的困難から抜け出せる?",
          ko: "언제 재정적 어려움에서 벗어날까요?",
        },
        {
          zh: "如何改善我的現金流?",
          en: "How can I improve my cash flow?",
          ja: "キャッシュフローをどう改善する?",
          ko: "현금 흐름을 어떻게 개선할까요?",
        },
      ],
    },
  ],

  // ───────── 健康類 ─────────
  health: [
    {
      titleZh: "整體健康",
      titleEn: "Overall Health",
      titleJa: "全体の健康",
      titleKo: "전체 건강",
      questions: [
        {
          zh: "近期我的健康狀況如何?",
          en: "What's my health outlook?",
          ja: "最近の健康状態は?",
          ko: "최근 건강 상태는?",
        },
        {
          zh: "我需要特別注意哪方面的健康?",
          en: "What health area needs attention?",
          ja: "どこに気をつけるべき?",
          ko: "어느 부분의 건강을 주의해야 할까요?",
        },
      ],
    },
    {
      titleZh: "身體調整",
      titleEn: "Body Care",
      titleJa: "体のケア",
      titleKo: "신체 관리",
      questions: [
        {
          zh: "該怎麼調整作息 / 飲食?",
          en: "How should I adjust my routine and diet?",
          ja: "生活リズムや食事をどう整える?",
          ko: "생활 리듬과 식단을 어떻게 조정할까요?",
        },
        {
          zh: "我的疲勞 / 壓力會改善嗎?",
          en: "Will my fatigue and stress ease?",
          ja: "疲れやストレスは改善する?",
          ko: "피로와 스트레스는 나아질까요?",
        },
      ],
    },
    {
      titleZh: "心理情緒",
      titleEn: "Mental & Emotional",
      titleJa: "心と感情",
      titleKo: "정서와 감정",
      questions: [
        {
          zh: "我的情緒狀態該怎麼調整?",
          en: "How can I balance my emotions?",
          ja: "感情をどう整える?",
          ko: "감정을 어떻게 조절할까요?",
        },
        {
          zh: "何時能走出目前的低潮?",
          en: "When will I move past this slump?",
          ja: "いつ今のスランプを抜け出せる?",
          ko: "언제 지금의 슬럼프에서 벗어날까요?",
        },
      ],
    },
    {
      titleZh: "治療與恢復",
      titleEn: "Treatment & Recovery",
      titleJa: "治療と回復",
      titleKo: "치료와 회복",
      questions: [
        {
          zh: "目前的治療方向適合嗎?",
          en: "Is my current treatment right?",
          ja: "今の治療方針は合っている?",
          ko: "지금의 치료 방향이 적합한가요?",
        },
        {
          zh: "我的身體恢復進度?",
          en: "How is my recovery progressing?",
          ja: "回復はどう進んでいる?",
          ko: "몸의 회복은 어떻게 진행되고 있나요?",
        },
      ],
    },
  ],

  // ───────── 學業類 ─────────
  study: [
    {
      titleZh: "學業運勢",
      titleEn: "Academic Outlook",
      titleJa: "学業運",
      titleKo: "학업운",
      questions: [
        {
          zh: "近期我的學業運如何?",
          en: "What's my academic outlook?",
          ja: "最近の学業運は?",
          ko: "최근 학업운은?",
        },
        {
          zh: "我的成績會進步嗎?",
          en: "Will my grades improve?",
          ja: "成績は伸びる?",
          ko: "성적이 오를까요?",
        },
      ],
    },
    {
      titleZh: "考試與升學",
      titleEn: "Exams",
      titleJa: "試験と進学",
      titleKo: "시험과 진학",
      questions: [
        {
          zh: "即將到來的考試會順利嗎?",
          en: "Will I do well on the upcoming exam?",
          ja: "試験はうまくいく?",
          ko: "다가오는 시험은 잘 볼 수 있을까요?",
        },
        {
          zh: "我能考上理想的學校嗎?",
          en: "Will I get into my dream school?",
          ja: "志望校に合格できる?",
          ko: "원하는 학교에 합격할 수 있을까요?",
        },
      ],
    },
    {
      titleZh: "學習方法",
      titleEn: "Study Methods",
      titleJa: "学習法",
      titleKo: "학습법",
      questions: [
        {
          zh: "適合我的學習方式?",
          en: "What study method works best for me?",
          ja: "私に合う勉強法は?",
          ko: "나에게 맞는 공부법은?",
        },
        {
          zh: "如何提升專注力與記憶?",
          en: "How to improve focus and memory?",
          ja: "集中力と記憶力をどう上げる?",
          ko: "집중력과 기억력을 어떻게 높일까요?",
        },
      ],
    },
    {
      titleZh: "師長同儕",
      titleEn: "Teachers & Peers",
      titleJa: "先生と仲間",
      titleKo: "교사와 친구",
      questions: [
        {
          zh: "與老師 / 同學的關係如何改善?",
          en: "How to improve relationships at school?",
          ja: "先生やクラスメートとの関係をどう改善する?",
          ko: "선생님이나 친구와의 관계를 어떻게 개선할까요?",
        },
      ],
    },
  ],

  // ───────── 綜合類 ─────────
  general: [
    {
      titleZh: "人生方向",
      titleEn: "Life Direction",
      titleJa: "人生の方向",
      titleKo: "인생 방향",
      questions: [
        {
          zh: "我目前的人生方向對嗎?",
          en: "Am I on the right path?",
          ja: "今の人生の方向は正しい?",
          ko: "지금의 인생 방향이 맞나요?",
        },
        {
          zh: "接下來半年該專注什麼?",
          en: "What should I focus on for the next 6 months?",
          ja: "これから半年、何に集中すべき?",
          ko: "앞으로 반년 무엇에 집중해야 할까요?",
        },
      ],
    },
    {
      titleZh: "自我成長",
      titleEn: "Self-Growth",
      titleJa: "自己成長",
      titleKo: "자기 성장",
      questions: [
        {
          zh: "我目前最需要學習的功課?",
          en: "What's the lesson I need most now?",
          ja: "今学ぶべき課題は?",
          ko: "지금 가장 필요한 교훈은?",
        },
        {
          zh: "如何更認識真實的自己?",
          en: "How can I know my true self?",
          ja: "本当の自分をどう知る?",
          ko: "진정한 나를 어떻게 알 수 있을까요?",
        },
      ],
    },
    {
      titleZh: "重大選擇",
      titleEn: "Major Choices",
      titleJa: "重要な選択",
      titleKo: "중요한 선택",
      questions: [
        {
          zh: "A 跟 B 我該選哪個?",
          en: "Should I choose A or B?",
          ja: "AとB、どちらを選ぶ?",
          ko: "A와 B 중 어느 쪽을 골라야 할까요?",
        },
        {
          zh: "這個決定會帶來好結果嗎?",
          en: "Will this decision lead to a good outcome?",
          ja: "この決断は良い結果になる?",
          ko: "이 결정은 좋은 결과로 이어질까요?",
        },
      ],
    },
    {
      titleZh: "家庭關係",
      titleEn: "Family",
      titleJa: "家族関係",
      titleKo: "가족 관계",
      questions: [
        {
          zh: "與家人的關係如何改善?",
          en: "How to improve family bonds?",
          ja: "家族との関係をどう改善する?",
          ko: "가족과의 관계를 어떻게 개선할까요?",
        },
        {
          zh: "我和父母的衝突該怎麼處理?",
          en: "How to handle conflict with parents?",
          ja: "親との衝突をどう解決する?",
          ko: "부모와의 갈등을 어떻게 풀어야 할까요?",
        },
      ],
    },
    {
      titleZh: "心靈靈性",
      titleEn: "Spirituality",
      titleJa: "精神とスピリチュアル",
      titleKo: "영성과 정신",
      questions: [
        {
          zh: "我這一階段的人生課題?",
          en: "What's my current life lesson?",
          ja: "今の人生の課題は?",
          ko: "지금 단계의 인생 과제는?",
        },
        {
          zh: "此刻宇宙想告訴我什麼?",
          en: "What is the universe telling me?",
          ja: "宇宙は今、私に何を伝えている?",
          ko: "우주는 지금 나에게 무엇을 말하나요?",
        },
      ],
    },
  ],
};
