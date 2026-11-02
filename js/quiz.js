/**
 * quiz.js
 * Quiz for the DCN Virtual Lab: 12 multiple-choice questions on MTU, fragmentation,
 * offset, Identification, MF, DF, reassembly, missing fragments, out-of-order delivery
 * and payload calculation.
 *
 * Numeric questions are computed with the real fragmentation engine
 * (VLab.Fragmentation), so the "correct" answers can never drift from the simulator.
 * Option order is shuffled on every attempt; the correct answer is tracked by value.
 *
 * Public API (window.VLab.Quiz):
 *   init(rootElement)   build the quiz inside rootElement (called once by app.js)
 *   restart()           start a new attempt
 */
(function (root) {
  'use strict';

  var Frag = root.VLab && root.VLab.Fragmentation;

  var rootEl = null;
  var questions = [];
  var index = 0;
  var score = 0;
  var answered = false;

  function el(tag, props, children) {
    var node = document.createElement(tag);
    var p = props || {};
    if (p.className) node.className = p.className;
    if (p.text !== undefined) node.textContent = p.text;
    if (p.attrs) Object.keys(p.attrs).forEach(function (k) { node.setAttribute(k, p.attrs[k]); });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  /** Run the real engine for a numeric question (fixed Identification, so results are repeatable). */
  function run(d, mtu, h, df) {
    return Frag.fragmentDatagram({ datagramSize: d, mtu: mtu, headerLength: h || 20, df: df || 0, identification: 4242 });
  }

  /** Build the question bank. Numeric answers come from the engine, not from hardcoded numbers. */
  function buildBank() {
    var r1 = run(4000, 1500);                       // Pmax 1480, 3 fragments
    var r2 = run(3000, 1000);                       // payload 2980, Pmax 976
    var r3 = run(2000, 600, 24);                    // header 24: Pmax = floor(576/8)*8 = 576
    var r4 = run(4000, 1500);
    var pmax2 = r2.maxFragmentPayload;
    var n2 = r2.fragments.length;
    var last2 = r2.fragments[n2 - 1];
    var f2 = r1.fragments[1];                       // second fragment of scenario 1
    var total1 = r1.fragments[r1.fragments.length - 1].totalLength;
    var r3n = r3.fragments.length;

    return [
      {
        q: 'What does MTU stand for, and what does it limit?',
        correct: 'Maximum Transmission Unit: the largest IP packet (header included) a link can carry',
        wrong: ['Maximum Transfer Unit: the largest payload only, without the header',
          'Minimum Transmission Unit: the smallest packet a link accepts',
          'Maximum Traffic Utilisation: the highest data rate of a link'],
        why: 'The MTU is the largest IP packet, header included, that a link can carry. Ethernet commonly uses 1500 bytes.'
      },
      {
        q: 'When does a router fragment a datagram?',
        correct: 'When the datagram is larger than the next link\'s MTU and DF = 0',
        wrong: ['Whenever the datagram is larger than 1500 bytes, whatever the DF flag says',
          'When the datagram is smaller than the MTU and MF = 1',
          'Only when the destination asks for it'],
        why: 'Fragmentation is needed when datagram size > MTU. It is allowed only if DF = 0. If DF = 1 the router drops the packet instead.'
      },
      {
        q: 'A datagram has total length 4000 bytes and a 20-byte header. What is the payload?',
        correct: String(r1.originalPayloadSize) + ' bytes',
        wrong: ['4000 bytes', '4020 bytes', String(r1.originalPayloadSize - 20) + ' bytes'],
        why: 'Payload = D - H = 4000 - 20 = ' + r1.originalPayloadSize + ' bytes.'
      },
      {
        q: 'MTU = 1500 and header length = 20. What is the maximum payload of a non-final fragment?',
        correct: String(r1.maxFragmentPayload) + ' bytes',
        wrong: ['1500 bytes', '1488 bytes', '1472 bytes'],
        why: 'Pmax = floor((MTU - H) / 8) x 8 = floor(1480 / 8) x 8 = ' + r1.maxFragmentPayload + ' bytes. It is already a multiple of 8.'
      },
      {
        q: 'A 4000-byte datagram (H = 20) crosses a link with MTU 1500. What is the Fragment Offset field of the second fragment?',
        correct: String(f2.fragmentOffset),
        wrong: [String(r1.maxFragmentPayload), String(f2.fragmentOffset + 1), '0'],
        why: 'The second fragment starts at byte ' + f2.byteOffset + '. The field counts 8-byte units, so ' + f2.byteOffset + ' / 8 = ' + f2.fragmentOffset + '.'
      },
      {
        q: 'A 3000-byte datagram (H = 20) meets MTU 1000. How many fragments are produced?',
        correct: String(n2),
        wrong: [String(n2 - 1), String(n2 + 1), String(n2 + 2)],
        why: 'Payload = 2980. Pmax = floor(980 / 8) x 8 = ' + pmax2 + '. Fragments = ceil(2980 / ' + pmax2 + ') = ' + n2 + '.'
      },
      {
        q: 'For the same 3000-byte datagram and MTU 1000, how many payload bytes does the final fragment carry?',
        correct: last2.payloadLength + ' bytes',
        wrong: [pmax2 + ' bytes', (last2.payloadLength + 20) + ' bytes', (last2.payloadLength + 8) + ' bytes'],
        why: 'Final payload = remaining bytes = 2980 - ' + (n2 - 1) + ' x ' + pmax2 + ' = ' + last2.payloadLength + ' bytes. Its MF is 0.'
      },
      {
        q: 'What is the Total Length of the last fragment in the 4000-byte, MTU 1500 example?',
        correct: total1 + ' bytes',
        wrong: ['1500 bytes', '1020 bytes', '1060 bytes'],
        why: 'The last payload is 3980 - 2 x 1480 = 1020 bytes. Total length = payload + header = 1020 + 20 = ' + total1 + ' bytes.'
      },
      {
        q: 'Why does every fragment of one datagram carry the same Identification value?',
        correct: 'So the destination can tell which fragments belong to the same original datagram',
        wrong: ['So the router can count how many fragments it created',
          'So the header checksum stays the same in every fragment',
          'So that fragments arrive in the correct order'],
        why: 'The destination groups fragments by source, destination, protocol and Identification. Order comes from the Fragment Offset, not from Identification.'
      },
      {
        q: 'Which fragment has the MF (More Fragments) flag set to 0?',
        correct: 'The final fragment (and any unfragmented datagram)',
        wrong: ['The first fragment', 'Every fragment', 'The fragment with the largest payload'],
        why: 'MF = 1 on every fragment except the last. MF = 0 with a non-zero offset tells the destination where the datagram ends.'
      },
      {
        q: 'A 4000-byte datagram with DF = 1 meets a link with MTU 1500. What happens?',
        correct: 'The router drops it and returns ICMP Type 3, Code 4 with the next-hop MTU',
        wrong: ['The router fragments it into three fragments anyway',
          'The router forwards it unchanged and the destination fragments it',
          'The router drops it silently with no message'],
        why: 'DF = 1 forbids fragmentation, so the router drops the packet and sends ICMP Destination Unreachable, Fragmentation Needed (Type 3, Code 4) containing the next-hop MTU.'
      },
      {
        q: 'Fragments arrive at the destination in the order 3, 1, 2. What happens?',
        correct: 'Reassembly still succeeds, because each fragment is placed using its offset',
        wrong: ['The datagram is discarded because the order is wrong',
          'Fragment 3 is treated as lost and must be resent',
          'The destination rebuilds the payload in arrival order'],
        why: 'Out of order is not loss. The destination places each payload at byte position offset x 8, never in arrival order.'
      },
      {
        q: 'One middle fragment never arrives. What does the destination do?',
        correct: 'It keeps the partial datagram until the reassembly timer expires, then discards it',
        wrong: ['It rebuilds the datagram and fills the gap with zeros',
          'It asks the router to resend only the missing fragment using IP',
          'It delivers the partial data to the application immediately'],
        why: 'IP has no retransmission. The gap stays missing, and when the reassembly timer expires the whole partial datagram is discarded. A higher layer such as TCP must resend.'
      },
      {
        q: 'A 2000-byte datagram has a 24-byte header (options present, all assumed copied) and meets MTU 600. How many fragments result?',
        correct: String(r3n),
        wrong: [String(r3n - 1), String(r3n + 1), String(r3n + 2)],
        why: 'Payload = 2000 - 24 = ' + r3.originalPayloadSize + '. Pmax = floor((600 - 24) / 8) x 8 = ' + r3.maxFragmentPayload + '. Fragments = ceil(' + r3.originalPayloadSize + ' / ' + r3.maxFragmentPayload + ') = ' + r3n + '.'
      },
      {
        q: 'After the fragments of the 4000-byte datagram are delivered, how does the destination know the original payload length?',
        correct: 'From the MF = 0 fragment: last offset x 8 + its payload length',
        wrong: ['From the Identification field', 'From the TTL of the first fragment', 'From the size of the first fragment'],
        why: 'Total payload = (last offset x 8) + last payload = ' + (r4.fragments[2].fragmentOffset * 8) + ' + ' + r4.fragments[2].payloadLength + ' = ' + r4.originalPayloadSize + ' bytes.'
      }
    ];
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function startAttempt() {
    questions = buildBank().map(function (b) {
      return { q: b.q, why: b.why, correct: b.correct, options: shuffle([b.correct].concat(b.wrong)) };
    });
    // Ask 12 of the 15 questions, in a random order.
    questions = shuffle(questions).slice(0, 12);
    index = 0;
    score = 0;
    answered = false;
    renderQuestion();
  }

  function renderQuestion() {
    var q = questions[index];
    answered = false;
    rootEl.textContent = '';
    var card = el('div', { className: 'card quiz-card' });
    card.appendChild(el('p', { className: 'quiz-progress', text: 'Question ' + (index + 1) + ' of ' + questions.length + '   Score: ' + score }));
    card.appendChild(el('p', { className: 'quiz-q', text: q.q }));

    var opts = el('div', { className: 'quiz-options', attrs: { role: 'group', 'aria-label': 'Answer options' } });
    var feedback = el('div', { className: 'quiz-feedback', attrs: { 'aria-live': 'polite' } });
    feedback.hidden = true;
    var nextBtn = el('button', { className: 'btn primary', text: (index === questions.length - 1) ? 'See my score' : 'Next question', attrs: { type: 'button' } });
    nextBtn.hidden = true;

    q.options.forEach(function (text) {
      var b = el('button', { className: 'quiz-opt', text: text, attrs: { type: 'button' } });
      b.addEventListener('click', function () {
        if (answered) return;
        answered = true;
        var right = (text === q.correct);
        if (right) score++;
        Array.prototype.forEach.call(opts.children, function (btn) {
          btn.disabled = true;
          if (btn.textContent === q.correct) btn.classList.add('correct');
        });
        if (!right) b.classList.add('wrong');
        feedback.hidden = false;
        feedback.className = 'quiz-feedback ' + (right ? 'ok' : 'bad');
        feedback.textContent = (right ? 'Correct. ' : 'Not quite. The answer is: ' + q.correct + '. ') + q.why;
        nextBtn.hidden = false;
        nextBtn.focus();
      });
      opts.appendChild(b);
    });

    nextBtn.addEventListener('click', function () {
      index++;
      if (index >= questions.length) renderResult(); else renderQuestion();
    });

    card.appendChild(opts);
    card.appendChild(feedback);
    card.appendChild(nextBtn);
    rootEl.appendChild(card);
  }

  function renderResult() {
    rootEl.textContent = '';
    var pct = Math.round((score / questions.length) * 100);
    var msg = pct >= 80 ? 'Excellent. You understand fragmentation and reassembly well.' :
      pct >= 50 ? 'Good effort. Revisit the Theory section and the Reassembly laboratory for the questions you missed.' :
        'Review the Theory section, then run the six scenarios and try again.';
    var card = el('div', { className: 'card quiz-card' });
    card.appendChild(el('h2', { text: 'Quiz complete' }));
    card.appendChild(el('p', { className: 'quiz-score', text: score + ' / ' + questions.length + '  (' + pct + '%)' }));
    card.appendChild(el('p', { text: msg }));
    var again = el('button', { className: 'btn primary', text: 'Retry quiz', attrs: { type: 'button' } });
    again.addEventListener('click', startAttempt);
    card.appendChild(again);
    rootEl.appendChild(card);
  }

  function init(rootElement) {
    rootEl = rootElement;
    if (!rootEl) return;
    if (!Frag) { rootEl.textContent = 'The quiz needs fragmentation.js, which did not load.'; return; }
    startAttempt();
  }

  root.VLab = root.VLab || {};
  root.VLab.Quiz = { init: init, restart: function () { if (rootEl && Frag) startAttempt(); } };
})(typeof window !== 'undefined' ? window : globalThis);
