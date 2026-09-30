export const PLAYBOOK = {
  stages: ["Skeptical", "Neutral", "Engaged", "Selling the role"],

  actions: {
    tell_a_story: {
      title: "Tell a story",
      tips: {
        when: [
          { signal: "raised_concern", text: "Pick a story that answers their doubt directly." },
        ],
        always: [
          "Situation, task, action, result: set it up in a sentence, spend most of the time on what you did, and finish with the outcome.",
          "Say \"I\", not \"we\", for the parts you did yourself.",
        ],
      },
    },
    show_your_thinking: {
      title: "Think out loud",
      tips: {
        when: [
          { signal: "technical_question", text: "Talk through the trade-offs. A clear approach counts as much as the final answer." },
        ],
        always: [
          "Restate the problem, say your approach before you dive in, and check in as you go.",
        ],
      },
    },
    ask_clarifying_question: {
      title: "Ask a clarifying question",
      tips: {
        when: [],
        always: [
          "Confirm what they're after, like \"Do you mean leading a team, or on your own?\" Then answer.",
        ],
      },
    },
    connect_to_role: {
      title: "Connect it to this role",
      tips: {
        when: [],
        always: [
          "Tie your answer to something specific about this team or product, and to what you want to do next.",
        ],
      },
    },
    address_concern: {
      title: "Address the concern",
      tips: {
        when: [
          { signal: "raised_concern", text: "Acknowledge it plainly, then give one piece of evidence that answers it. Don't get defensive." },
        ],
        always: [
          "Name the concern in your own words, answer it with a specific example, and move forward.",
        ],
      },
    },
    discuss_compensation: {
      title: "Share your range",
      tips: {
        when: [],
        always: [
          "Give a researched range, say you're flexible for the right role, and ask about the full package.",
        ],
      },
    },
    ask_your_questions: {
      title: "Ask your questions",
      tips: {
        when: [
          { signal: "mentions_next_steps", text: "Before you go, ask what the next steps are and when you'll hear back." },
        ],
        always: [
          "Ask about the team's biggest challenge right now, and what success looks like in the first 90 days.",
        ],
      },
    },
    wrap_up_answer: {
      title: "Wrap it up",
      tips: {
        when: [],
        always: [
          "Land your point in one sentence and hand it back: \"Does that answer your question?\"",
        ],
      },
    },
    no_action: {
      title: "Keep listening",
      tips: { when: [], always: [] },
    },
  },

  priority: [
    "address_concern",
    "wrap_up_answer",
    "ask_your_questions",
    "discuss_compensation",
    "ask_clarifying_question",
    "tell_a_story",
    "show_your_thinking",
    "connect_to_role",
    "no_action",
  ],

  rules: [
    {
      when: (signals) => (signals.invites_questions ?? 0) >= 0.7,
      block: ["tell_a_story", "show_your_thinking"],
      note: "They've asked for your questions, so it's your turn to ask.",
    },
  ],

  listeningTips: [
    "Listen to the whole question before you start answering.",
    "Notice what they follow up on; that's what they care about.",
  ],

  copy: {
    stageKicker: "Interviewer interest",
    idleStage: "Waiting for the interviewer",
    other: "Interviewer",
    otherSpeaking: "Interviewer speaking",
    typeOther: "Type what the interviewer said",
    idleTip: "Press Start listening, or type what the interviewer says below. Press S to switch who's speaking.",
  },

  signals: {
    behavioral_question: { label: "Behavioral question" },
    technical_question: { label: "Problem to solve" },
    raised_concern: { label: "Raised a concern", warn: 0.6, block: 0.8 },
    compensation_topic: { label: "Pay came up" },
    invites_questions: { label: "Invited your questions" },
    mentions_next_steps: { label: "Next steps mentioned" },
  },

  sample: [
    ["customer", "Thanks for making the time. To start, tell me a bit about yourself."],
    ["rep", "Sure. I've spent five years in customer operations, most recently leading a team of six at a software company."],
    ["customer", "Tell me about a time you had to handle a difficult situation with someone on your team."],
    ["rep", "We had a missed deadline last spring, and one teammate felt blamed for it."],
    ["customer", "I'll be honest, most of your experience is at smaller companies. How would you handle a team our size?"],
    ["rep", "Fair question. I scaled our support process from two people to six while the customer base tripled."],
    ["customer", "That's helpful. What are you looking for in terms of salary?"],
    ["customer", "Great. We're nearly out of time. Do you have any questions for me? The next round would be with the director."],
  ],
};
