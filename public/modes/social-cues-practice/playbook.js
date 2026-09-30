export const PLAYBOOK = {
  stages: ["Missed the cue", "A bit off", "Natural", "In tune"],

  actions: {
    notice_the_cue: {
      title: "Notice the cue",
      tips: {
        when: [],
        always: [
          "Look at their last line again: is there a feeling, a joke, or a hint in it? Reply to that first.",
        ],
      },
    },
    let_them_go: {
      title: "Let them go",
      tips: {
        when: [
          { signal: "keeps_them_talking", text: "They said they need to leave, and your reply started something new. Save it for next time." },
        ],
        always: [
          "When someone mentions the time or a meeting, wrap up warmly: \"Go! Talk later.\"",
        ],
      },
    },
    acknowledge_them: {
      title: "Acknowledge them",
      tips: {
        when: [],
        always: [
          "When someone shares something hard, name it first: \"Oh no, that sounds rough.\" Then ask if they want to talk.",
        ],
      },
    },
    match_the_tone: {
      title: "Match their tone",
      tips: {
        when: [],
        always: [
          "Mirror their energy: light for a joke, gentle for something serious.",
        ],
      },
    },
    respect_the_boundary: {
      title: "Respect the boundary",
      tips: {
        when: [],
        always: [
          "When someone says they'd rather not talk about it, say \"Of course\" and let it go. Offer to be around later.",
        ],
      },
    },
    ask_back: {
      title: "Ask something back",
      tips: {
        when: [],
        always: [
          "Answer, then pass it back: \"What about you?\" It shows you're interested in them too.",
        ],
      },
    },
    give_them_room: {
      title: "Give them room",
      tips: {
        when: [],
        always: [
          "Keep your part short so they have space to talk.",
        ],
      },
    },
    in_tune: {
      title: "You read it well",
      tips: {
        when: [
          { signal: "acknowledges_feeling", text: "You picked up on how they felt. That's the heart of it." },
        ],
        always: [
          "That fit the moment. Noticing the cue first is the whole skill.",
        ],
      },
    },
  },

  priority: [
    "let_them_go",
    "respect_the_boundary",
    "acknowledge_them",
    "notice_the_cue",
    "match_the_tone",
    "give_them_room",
    "ask_back",
    "in_tune",
  ],

  rules: [],

  listeningTips: [
    "No single fix stands out. Reread their last line and look for the feeling or the hint in it.",
  ],

  // Practice: each reply is scored on its own
  config: { stageSmoothing: 1, stageHysteresis: 0, switchMargin: 0, confirmUpdates: 1 },

  copy: {
    stageKicker: "Your reply",
    idleStage: "Reply to see how it lands",
    other: "Them",
    actionKicker: "Work on",
    listenTitle: "No single fix",
    idleTip: "Each line has a cue in it. Read it, reply the way you would, and see whether you caught it.",
  },

  signals: {
    responds_to_cue: { label: "Responds to the cue" },
    acknowledges_feeling: { label: "Acknowledges feelings" },
    asks_question: { label: "Asks a question" },
    keeps_them_talking: { label: "Keeps them talking" },
  },

  // Each line carries a cue to notice
  scenarios: [
    {
      title: "The hallway chat",
      setup: "A coworker you like stops by your desk.",
      lines: [
        "Hey! How was your weekend?",
        "Oh nice. Mine was kind of rough, honestly. My dog's been sick.",
        "Thanks. Anyway... I've got a meeting in two minutes.",
      ],
    },
    {
      title: "Joining a group",
      setup: "Lunch with a few coworkers. They're in the middle of a story when you sit down.",
      lines: [
        "...and then he walked straight into the glass door. In front of the whole client team!",
        "Okay, okay. Anyway, did anyone catch the game last night?",
        "What about you, do you follow any sports?",
      ],
    },
    {
      title: "The quiet friend",
      setup: "You call a friend who's been quieter than usual lately.",
      lines: [
        "Hey. Yeah, I'm fine.",
        "It's just been a long week. Work stuff.",
        "Honestly, I don't really want to get into it right now.",
      ],
    },
    {
      title: "Being teased",
      setup: "You're late to meet a friend, again. They're smiling when you arrive.",
      lines: [
        "Oh look who finally showed up. Did you walk here from another country?",
        "I'm kidding, I'm kidding. I already ordered, do you want anything?",
      ],
    },
  ],
};
