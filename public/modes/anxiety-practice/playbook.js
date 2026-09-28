// Encouraging by design: feedback names one small thing, and every try counts.
export const PLAYBOOK = {
  // Shown on the feedback card whatever the suggestion, when the user says they feel unsafe
  alert: {
    signal: "in_distress",
    min: 0.6,
    title: "Take care of yourself first",
    text: "You don't have to get through this alone. If you feel unsafe, reach out to someone you trust, or call or text 988 (US) or your local crisis line.",
  },

  stages: ["Stuck", "Hesitant", "Clear", "Confident"],

  actions: {
    say_it_plainly: {
      title: "Say it plainly",
      tips: {
        when: [],
        always: [
          "Try starting with \"I'd like…\" or \"Could I…\". Saying it directly is polite, not pushy.",
        ],
      },
    },
    skip_the_apology: {
      title: "Skip the apology",
      tips: {
        when: [
          { signal: "clear_request", text: "Your request was clear. Drop the \"sorry\" and it'll sound as confident as it is." },
        ],
        always: [
          "You're not bothering anyone by asking. Swap \"Sorry\" for \"Hi\" or \"Thanks\".",
        ],
      },
    },
    keep_it_short: {
      title: "Keep it short",
      tips: {
        when: [],
        always: [
          "One reason is enough, and sometimes none is needed. Short answers sound sure.",
        ],
      },
    },
    hold_your_ground: {
      title: "Hold your ground",
      tips: {
        when: [],
        always: [
          "It's okay to repeat yourself kindly: \"I understand, but I still can't this time.\"",
        ],
      },
    },
    ask_a_question: {
      title: "Just ask",
      tips: {
        when: [],
        always: [
          "If you're not sure, asking is the confident move: \"Could you tell me how that works?\"",
        ],
      },
    },
    you_did_it: {
      title: "You did it",
      tips: {
        when: [
          { signal: "friendly", text: "Clear and friendly. That's exactly how people who feel at ease sound." },
        ],
        always: [
          "That was clear and polite. That's all it takes.",
        ],
      },
    },
  },

  priority: [
    "hold_your_ground",
    "say_it_plainly",
    "skip_the_apology",
    "keep_it_short",
    "ask_a_question",
    "you_did_it",
  ],

  rules: [],

  listeningTips: [
    "Nice try. Say what you need in one short sentence, then stop.",
  ],

  // Practice: each reply is scored on its own
  config: { stageSmoothing: 1, stageHysteresis: 0, switchMargin: 0, confirmUpdates: 1 },

  copy: {
    stageKicker: "How you came across",
    idleStage: "Reply when you're ready",
    other: "Them",
    actionKicker: "Try this",
    listenTitle: "Keep going",
    idleTip: "Take your time. There's no timer, and you can try any line again as many times as you like.",
    careNote: "A supportive tool, not a substitute for professional care.",
  },

  signals: {
    clear_request: { label: "Says what you need" },
    friendly: { label: "Friendly" },
    apologizes: { label: "Extra apologies", warn: 0.6 },
    over_explains: { label: "Over-explains", warn: 0.6 },
    in_distress: { label: "Feeling unsafe", warn: 0.4, block: 0.6 },
  },

  scenarios: [
    {
      title: "Booking an appointment by phone",
      setup: "You're calling your doctor's office. The receptionist picks up.",
      lines: [
        "Good morning, Riverside Medical, how can I help you?",
        "Sure. Can I get your name and date of birth?",
        "We have Thursday at 2:30 or Monday at 9. Which works better?",
        "You're all set. Anything else I can help with?",
      ],
    },
    {
      title: "Saying no",
      setup: "A coworker asks you to cover their shift. You already have plans.",
      lines: [
        "Hey, any chance you could cover my shift on Saturday? I'd really owe you.",
        "Oh come on, it's just a few hours. Nobody else can do it.",
        "Okay, fair enough. No worries.",
      ],
    },
    {
      title: "Sending food back",
      setup: "Your order at a restaurant came out wrong. The server stops by.",
      lines: [
        "How is everything tasting?",
        "Oh, I'm sorry about that. What did you order?",
        "I'll get that fixed for you right away.",
      ],
    },
    {
      title: "Asking for help at work",
      setup: "You're stuck on a task and decide to ask your manager.",
      lines: [
        "Hey, what's up?",
        "Okay, which part are you stuck on?",
        "Got it. Want to go through it together this afternoon?",
      ],
    },
    {
      title: "Introducing yourself",
      setup: "A networking event. Someone turns to you by the snack table.",
      lines: [
        "Hi! I don't think we've met. I'm Dana.",
        "Nice to meet you. What brings you here tonight?",
        "Oh, interesting. How did you get into that?",
      ],
    },
  ],
};
