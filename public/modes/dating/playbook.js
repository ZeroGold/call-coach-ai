export const PLAYBOOK = {
  stages: ["Shuts it down", "Stalls", "Keeps it going", "Draws them in"],

  actions: {
    ask_back: {
      title: "Ask something back",
      tips: {
        when: [
          { signal: "shares_something_personal", text: "You shared something real. Now hand it back: “What about you?” keeps it a two-way street." },
        ],
        always: [
          "End with a question about them, so they have somewhere to go.",
        ],
      },
    },
    build_on_them: {
      title: "Pick up on what they said",
      tips: {
        when: [
          { signal: "builds_on_their_words", max: 0.4, text: "They gave you a detail to work with. Name it and ask about it before moving on." },
        ],
        always: [
          "Repeat one specific thing they mentioned and ask what it's like for them.",
        ],
      },
    },
    open_up: {
      title: "Give them more",
      tips: {
        when: [
          { signal: "shares_something_personal", max: 0.4, text: "Add one concrete detail about yourself: a place, a story, or why you like it." },
        ],
        always: [
          "Answer with a detail or a quick story instead of a one-liner.",
        ],
      },
    },
    add_warmth: {
      title: "Add some warmth",
      tips: {
        when: [
          { signal: "negative_tone", text: "That came across a bit negative. Say what you do enjoy instead." },
        ],
        always: [
          "Show you're glad to be there. React to what they say before you answer.",
        ],
      },
    },
    lighten_up: {
      title: "Lighten it up",
      tips: {
        when: [
          { signal: "negative_tone", text: "Save the heavy stuff for later. Steer toward something you're looking forward to." },
        ],
        always: [
          "Keep it easy. A little humor or a lighter topic takes the pressure off.",
        ],
      },
    },
    give_them_room: {
      title: "Give them room",
      tips: {
        when: [
          { signal: "asks_question", max: 0.4, text: "You've said a lot. Wrap it up with a question so they can jump in." },
        ],
        always: [
          "Say less, then pass it back. Aim for a few sentences, not a speech.",
        ],
      },
    },
    keep_it_up: {
      title: "Keep it up",
      tips: {
        when: [
          { signal: "playful", text: "Nice light touch. Humor like that makes it easy to talk to you." },
          { signal: "builds_on_their_words", text: "You picked up on what they said, which shows you're listening." },
        ],
        always: [
          "That lands well. It's warm, specific, and gives them something to answer.",
        ],
      },
    },
  },

  priority: [
    "add_warmth",
    "lighten_up",
    "build_on_them",
    "ask_back",
    "open_up",
    "give_them_room",
    "keep_it_up",
  ],

  rules: [
    {
      when: (signals) => (signals.negative_tone ?? 0) >= 0.7,
      block: ["keep_it_up"],
      note: "The tone came across negative, so that's the thing to fix first.",
    },
  ],

  listeningTips: [
    "No single fix stands out. Try a reply that's specific and ends with a question.",
  ],

  // Rehearsal: each reply is scored on its own, so there's no smoothing between attempts
  config: { stageSmoothing: 1, stageHysteresis: 0, switchMargin: 0, confirmUpdates: 1 },

  copy: {
    stageKicker: "Your reply",
    idleStage: "Reply to see how it lands",
    other: "Your date",
    actionKicker: "Work on",
    listenTitle: "No single fix",
  },

  signals: {
    asks_question: { label: "Asks a question" },
    builds_on_their_words: { label: "Builds on what they said" },
    shares_something_personal: { label: "Shares something personal" },
    playful: { label: "Playful" },
    negative_tone: { label: "Negative tone", warn: 0.5, block: 0.7 },
  },

  // Your date says each line in turn; you reply to each one
  scenarios: [
    {
      title: "Coffee, ten minutes in",
      setup: "You're ten minutes into a coffee date. It's going fine so far.",
      lines: [
        "So what do you like to do when you're not working?",
        "Oh nice. I've been getting into pottery lately, which mostly means making lopsided bowls.",
        "What about you, is there something you've been wanting to try?",
        "Honestly, I almost cancelled today. Work has been a lot this week.",
      ],
    },
    {
      title: "The awkward pause",
      setup: "Dinner date. The food just arrived and neither of you has said anything for a bit.",
      lines: [
        "So... this is nice.",
        "I don't usually do the app thing. My friend kind of pushed me into it.",
        "Do you have any plans for the summer?",
      ],
    },
    {
      title: "Second date walk",
      setup: "You're walking through a park on a second date. Last time, they did most of the talking.",
      lines: [
        "I feel like I talked your ear off last time. Tell me something about you I wouldn't guess.",
        "Okay, that's actually really cool. How did you get into that?",
        "I should say, I'm pretty close with my family. They'll probably want to meet you at some point.",
      ],
    },
  ],
};
