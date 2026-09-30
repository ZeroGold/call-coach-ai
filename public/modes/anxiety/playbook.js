// Gentle by design: every suggestion is small, and the gauge shows how the other
// person is actually responding, which is usually better than anxiety predicts.
export const PLAYBOOK = {
  // Shown on the next-step card whatever the suggestion, when the user says they feel unsafe
  alert: {
    signal: "in_distress",
    min: 0.6,
    title: "Take care of yourself first",
    text: "You don't have to get through this alone. If you feel unsafe, reach out to someone you trust, or call or text 988 (US) or your local crisis line.",
  },

  stages: ["Tense", "Neutral", "Friendly", "Going well"],

  actions: {
    you_are_doing_fine: {
      title: "You're doing fine",
      tips: {
        when: [
          { signal: "other_is_patient", text: "They're being patient with you. There's no rush." },
        ],
        always: [
          "It's going okay. You don't have to be perfect, just keep going.",
        ],
      },
    },
    pause_and_breathe: {
      title: "Pause and breathe",
      tips: {
        when: [
          { signal: "other_is_frustrated", text: "Their tone is about their day, not about you. Answer calmly and simply." },
        ],
        always: [
          "Breathe in for four, out for six. A short pause sounds thoughtful, not awkward.",
        ],
      },
    },
    say_what_you_need: {
      title: "Say what you need",
      tips: {
        when: [],
        always: [
          "One sentence is enough: \"I'm calling to…\" or \"I'd like to…\"",
        ],
      },
    },
    ask_them_to_repeat: {
      title: "Ask them to repeat it",
      tips: {
        when: [],
        always: [
          "\"Sorry, could you say that again?\" is completely normal. People ask it all the time.",
        ],
      },
    },
    take_a_moment: {
      title: "Take a moment",
      tips: {
        when: [],
        always: [
          "You can ask for time: \"Give me a second to find that.\" Then take it.",
        ],
      },
    },
    skip_the_apology: {
      title: "Skip the apology",
      tips: {
        when: [
          { signal: "user_apologizing", text: "You haven't done anything wrong. Try \"Thanks for your patience\" instead of \"Sorry\"." },
        ],
        always: [
          "Asking for things is normal. You don't need to apologize for it.",
        ],
      },
    },
    close_politely: {
      title: "You can wrap up",
      tips: {
        when: [
          { signal: "need_is_met", text: "You got what you needed. That's the whole job done." },
        ],
        always: [
          "\"Great, thanks so much for your help. Bye!\" is all it takes.",
        ],
      },
    },
    no_action: {
      title: "You've got this",
      tips: { when: [], always: [] },
    },
  },

  priority: [
    "pause_and_breathe",
    "take_a_moment",
    "ask_them_to_repeat",
    "skip_the_apology",
    "say_what_you_need",
    "close_politely",
    "you_are_doing_fine",
    "no_action",
  ],

  rules: [
    {
      when: (signals) => (signals.in_distress ?? 0) >= 0.6,
      block: ["say_what_you_need", "ask_them_to_repeat", "skip_the_apology", "close_politely", "you_are_doing_fine"],
      note: "Your wellbeing comes first. It's okay to pause or end the conversation.",
    },
  ],

  listeningTips: [
    "Breathe slowly. You don't need to plan every word.",
    "Most people are focused on their own part of the conversation, not judging yours.",
  ],

  copy: {
    stageKicker: "How it's going",
    idleStage: "Waiting for them to speak",
    other: "Other person",
    otherSpeaking: "They're speaking",
    typeOther: "Type what the other person said",
    listenTitle: "You've got this",
    careNote: "A supportive tool, not a substitute for professional care.",
  },

  signals: {
    other_is_patient: { label: "They're being patient" },
    need_is_met: { label: "You got what you needed" },
    user_apologizing: { label: "Apologizing a lot", warn: 0.6 },
    other_is_frustrated: { label: "They sound frustrated", warn: 0.6 },
    in_distress: { label: "Feeling unsafe", warn: 0.4, block: 0.6 },
  },

  sample: [
    ["customer", "Good morning, Riverside Medical, how can I help you?"],
    ["rep", "Hi, sorry, um, sorry to bother you. I was wondering if maybe I could make an appointment?"],
    ["customer", "Of course, no bother at all. What's it for?"],
    ["rep", "Just a check-up. Sorry, I should have said."],
    ["customer", "No problem. We have Thursday at 2:30 or Monday at 9. Take your time."],
    ["rep", "Thursday at 2:30, please."],
    ["customer", "Perfect, you're all set for Thursday. Anything else I can help with?"],
  ],
};
