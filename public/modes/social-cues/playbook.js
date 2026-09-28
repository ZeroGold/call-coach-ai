// Each action says what to do, and a first tip names the cue behind it,
// so the coach teaches the pattern as well as the response.
export const PLAYBOOK = {
  stages: ["Ready to go", "Polite", "Engaged", "Enjoying it"],

  actions: {
    ask_follow_up: {
      title: "Ask a follow-up",
      tips: {
        when: [],
        always: [
          "They're sharing details, which is an invitation. Ask about the part they seemed most excited about.",
        ],
      },
    },
    give_them_a_turn: {
      title: "Give them a turn",
      tips: {
        when: [
          { signal: "asked_you_something", text: "Answer their question briefly, then hand it back: \"What about you?\"" },
        ],
        always: [
          "You've been doing most of the talking. Finish your thought and ask them something.",
        ],
      },
    },
    wrap_up_kindly: {
      title: "Wrap up kindly",
      tips: {
        when: [
          { signal: "wants_to_leave", text: "\"Anyway\", checking the time, or short replies usually mean they need to go. That's about their schedule, not about you." },
        ],
        always: [
          "Let them go warmly: \"I'll let you get to it. Good talking to you!\"",
        ],
      },
    },
    check_in: {
      title: "Check in gently",
      tips: {
        when: [
          { signal: "upset", text: "A flat tone or a mention of something hard can mean they're having a rough time." },
        ],
        always: [
          "Ask simply, and give them an out: \"You seem a bit off today. Everything okay? No pressure.\"",
        ],
      },
    },
    acknowledge_feelings: {
      title: "Acknowledge how they feel",
      tips: {
        when: [
          { signal: "sets_a_boundary", text: "They said they'd rather not get into it. Respect that and follow their lead." },
        ],
        always: [
          "Name it before you add anything: \"That sounds really stressful.\" You don't need to fix it.",
        ],
      },
    },
    play_along: {
      title: "Play along",
      tips: {
        when: [
          { signal: "joking", text: "An exaggerated or teasing line is usually a joke. A laugh or a light comeback fits better than a serious answer." },
        ],
        always: [
          "Keep it light: smile, laugh, or tease back gently.",
        ],
      },
    },
    clarify: {
      title: "Ask what they mean",
      tips: {
        when: [],
        always: [
          "It's fine not to know. \"Wait, do you mean…?\" is friendly, not awkward.",
        ],
      },
    },
    follow_their_topic: {
      title: "Follow their topic",
      tips: {
        when: [
          { signal: "changed_topic", text: "A sudden new topic often means they're done with the last one. Go with the new one." },
        ],
        always: [
          "Pick up what they just brought up rather than going back.",
        ],
      },
    },
    no_action: {
      title: "Keep listening",
      tips: { when: [], always: [] },
    },
  },

  priority: [
    "wrap_up_kindly",
    "check_in",
    "acknowledge_feelings",
    "follow_their_topic",
    "play_along",
    "clarify",
    "give_them_a_turn",
    "ask_follow_up",
    "no_action",
  ],

  rules: [
    {
      when: (signals) => (signals.wants_to_leave ?? 0) >= 0.7,
      block: ["ask_follow_up"],
      note: "They're hinting they need to go, so this isn't the moment for a new question.",
    },
    {
      when: (signals) => (signals.sets_a_boundary ?? 0) >= 0.7,
      block: ["check_in", "ask_follow_up"],
      note: "They asked not to get into it. Let it be.",
    },
  ],

  listeningTips: [
    "Notice how long their answers are: longer usually means interested.",
    "Listen for questions back to you. They're a good sign.",
  ],

  copy: {
    stageKicker: "Their engagement",
    idleStage: "Waiting for them to speak",
    other: "Other person",
    otherSpeaking: "They're speaking",
    typeOther: "Type what they said",
    idleTip: "Press Start listening, or type what they say below. Press S to switch who's speaking.",
  },

  signals: {
    asked_you_something: { label: "Asked you something" },
    joking: { label: "Joking or teasing" },
    changed_topic: { label: "Changed the topic" },
    upset: { label: "Seems upset", warn: 0.6 },
    sets_a_boundary: { label: "Set a boundary", warn: 0.6 },
    wants_to_leave: { label: "Wants to wrap up", warn: 0.6 },
  },

  sample: [
    ["customer", "Hey! How was your weekend?"],
    ["rep", "Good! I finally finished that puzzle I've been working on for a month. It's a thousand pieces, all sky."],
    ["customer", "Ha, that sounds like torture. Mine was kind of rough, honestly. My dog's been sick."],
    ["rep", "Oh no, I'm sorry. Is she doing okay?"],
    ["customer", "Yeah, she's on the mend. Thanks for asking."],
    ["customer", "Anyway, I've got a meeting in two minutes, I should run."],
  ],
};
