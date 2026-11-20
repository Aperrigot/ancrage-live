(function () {
  "use strict";
  var API = "https://tixiaahenxcykhgzkmdu.supabase.co/rest/v1/rpc/";
  var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpeGlhYWhlbnhjeWtoZ3prbWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MTkwMTcsImV4cCI6MjEwOTQ5NTAxN30.GiRwUOUeiZiqDoLPqQ4nLEnHk-DcreT3tZN1v6db6fk";

  var SESSIONS = {
    quiz: {
      title: "Petit quiz de culture entrepreneuriale",
      groups: { a: "Moitié gauche", b: "Moitié droite" },
      questions: [
        { qid: "q1", kind: "choice", text: "À l’origine, YouTube devait être…",
          choices: [["rencontre", "Un site de rencontre"], ["cours", "Une plateforme de cours en ligne"], ["recettes", "Un site de recettes de cuisine"], ["messagerie", "Une messagerie vidéo"]] },
        { qid: "q2", kind: "choice", text: "Au départ, les fondateurs d’Airbnb louaient…",
          choices: [["matelas", "Des matelas gonflables"], ["hotel", "Des chambres d’hôtel"], ["parking", "Des places de parking"], ["bateaux", "Des bateaux"]] },
        { qid: "q3", kind: "choice",
          text: { a: "Selon vous, l’équipe de GRP Lab a-t-elle mis plus ou moins de 3 mois pour concevoir le GRP ?",
                  b: "Selon vous, l’équipe de GRP Lab a-t-elle mis plus ou moins de 10 ans pour concevoir le GRP ?" },
          choices: { a: [["plus", "Plus de 3 mois"], ["moins", "Moins de 3 mois"]], b: [["plus", "Plus de 10 ans"], ["moins", "Moins de 10 ans"]] } },
        { qid: "q4", kind: "number", text: "Et selon vous, combien de temps ?", unit: "mois", min: 0, max: 600, units: [["mois", "mois", 1], ["ans", "années", 12]], short: "Combien de temps ? (réponses converties en mois)" }
      ]
    },
    jeu: {
      title: "À vous de jouer",
      groups: { x: "Toute la salle" },
      questions: [
        { qid: "n1", kind: "number", text: "Offre de stage de 6 mois, gratification non indiquée. Le recruteur vous demande : « Et toi, tu veux combien ? »", unit: "€ par mois", min: 0, max: 10000, short: "Négo, 1er essai" },
        { qid: "n2", kind: "number", text: "On rejoue. Même recruteur, même question : « Et toi, tu veux combien ? »", unit: "€ par mois", min: 0, max: 10000, short: "Négo, 2e essai" },
        { qid: "u", kind: "choice", text: "L’ancrage, c’est plutôt…", choices: [["utile", "Utile"], ["nuisible", "Nuisible"]], short: "Utile ou nuisible" },
        { qid: "e", kind: "open", text: "Expliquez l’ancrage en une phrase à un enfant de 6 ans.", max: 200, short: "Enfant de 6 ans" }
      ]
    }
  };

  function rpc(fn, args) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 9000);
    return fetch(API + fn, {
      method: "POST",
      headers: { "apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json" },
      body: JSON.stringify(args || {}),
      signal: ctrl ? ctrl.signal : undefined,
      cache: "no-store"
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    }, function (e) { clearTimeout(timer); throw e; });
  }

  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "class") n.className = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function pick(v, grp) { return (v && typeof v === "object" && !Array.isArray(v)) ? v[grp] : v; }
  function fmt(n) {
    if (n === null || n === undefined || isNaN(n)) return "…";
    var r = Math.round(Number(n) * 10) / 10;
    return r.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  }
  function parseNum(s) {
    var t = String(s || "").replace(/\s| | /g, "").replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(t)) return null;
    return Number(t);
  }
  function ans(m) { var y = m / 12; return fmt(y) + (y >= 2 ? " ans" : " an"); }
  function rep(n) { n = n || 0; return n + (n > 1 ? " réponses" : " réponse"); }
  function uid() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }

  /* ---------- Participant ---------- */
  function participant(root, sid, grp) {
    var S = SESSIONS[sid];
    var pid = store.get("ancrage:pid") || uid();
    store.set("ancrage:pid", pid);
    var akey = "ancrage:" + sid + ":" + grp + ":done";
    var done = {};
    try { done = JSON.parse(store.get(akey) || "{}") || {}; } catch (e) { done = {}; }
    var state = null, shown = null, busy = false, failures = 0;

    var head = el("div", null, [el("p", { class: "kicker", text: "IAE Bordeaux · UE 18" }), el("h1", { text: S.title }), el("div", { class: "rope", "aria-hidden": "true" })]);
    var body = el("div", { "aria-live": "polite" });
    var foot = el("p", { class: "foot", text: "Réponses anonymes. Aucune connexion requise." });
    root.appendChild(el("div", { class: "wrap" }, [head, body, foot]));

    function markDone(qid) { done[qid] = 1; store.set(akey, JSON.stringify(done)); }

    function current() {
      if (!state) return null;
      var open = S.questions.slice(0, state.unlocked);
      if (state.mode === "live" && open.length) open = open.slice(-1);
      for (var i = 0; i < open.length; i++) if (!done[open[i].qid]) return open[i];
      return null;
    }

    function waitView(msg) {
      shown = "wait:" + msg;
      body.innerHTML = "";
      body.appendChild(el("div", { class: "wait" }, [el("p", { text: msg }), el("div", { class: "dots", "aria-hidden": "true" }, [el("i"), el("i"), el("i")])]));
    }

    function render() {
      if (busy) return;
      if (!state) { if (shown !== "load") { shown = "load"; body.innerHTML = ""; body.appendChild(el("div", { class: "wait" }, [el("p", { text: "Connexion…" })])); } return; }
      var q = current();
      if (!q) {
        var answered = S.questions.some(function (x) { return done[x.qid]; });
        var msg = state.unlocked === 0 ? "La question arrive. Gardez cette page ouverte." :
          (answered ? "Merci ! Gardez cette page ouverte : la question suivante s’affichera ici." : "Gardez cette page ouverte : la question suivante s’affichera ici.");
        if (shown !== "wait:" + msg) waitView(msg);
        return;
      }
      if (shown === q.qid) return;
      shown = q.qid;
      var idx = S.questions.indexOf(q);
      body.innerHTML = "";
      if (state.mode === "sequence") body.appendChild(el("p", { class: "prog", text: "Question " + (idx + 1) + " sur " + S.questions.length }));
      var qid = "qt-" + q.qid;
      body.appendChild(el("p", { class: "q", id: qid, text: pick(q.text, grp) }));
      var err = el("p", { class: "err", role: "alert" });
      var send = el("button", { class: "btn", type: "button", text: "Envoyer" });
      var getValue;
      if (q.kind === "choice") {
        var sel = null;
        var list = el("div", { class: "choices", role: "group", "aria-labelledby": qid });
        pick(q.choices, grp).forEach(function (c) {
          var b = el("button", { class: "choice", type: "button", "aria-pressed": "false", text: c[1] });
          b.addEventListener("click", function () {
            sel = c[0]; err.textContent = "";
            Array.prototype.forEach.call(list.children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
          });
          list.appendChild(b);
        });
        body.appendChild(list);
        getValue = function () { if (!sel) { err.textContent = "Choisissez une réponse."; return null; } return { p_choice: sel }; };
      } else if (q.kind === "number") {
        var inp = el("input", { class: "num", type: "text", inputmode: "decimal", autocomplete: "off", "aria-labelledby": qid, placeholder: "Votre nombre" });
        inp.addEventListener("input", function () { err.textContent = ""; });
        inp.addEventListener("keydown", function (e) { if (e.key === "Enter") send.click(); });
        var factor = 1, unitPicked = !q.units;
        if (q.units) {
          body.appendChild(el("div", { class: "field" }, [inp]));
          var ul = el("div", { class: "choices units", role: "group", "aria-label": "Unité" });
          q.units.forEach(function (u) {
            var ub = el("button", { class: "choice", type: "button", "aria-pressed": "false", text: "en " + u[1] });
            ub.addEventListener("click", function () {
              factor = u[2]; unitPicked = true; err.textContent = "";
              Array.prototype.forEach.call(ul.children, function (x) { x.setAttribute("aria-pressed", x === ub ? "true" : "false"); });
            });
            ul.appendChild(ub);
          });
          body.appendChild(ul);
        } else {
          body.appendChild(el("div", { class: "field" }, [inp, el("span", { class: "unit", text: q.unit })]));
        }
        getValue = function () {
          var v = parseNum(inp.value);
          if (v === null) { err.textContent = "Entrez un nombre (chiffres uniquement)."; return null; }
          if (!unitPicked) { err.textContent = "Choisissez l’unité : mois ou années."; return null; }
          var m = Math.round(v * factor * 100) / 100;
          if (m < q.min || m > q.max) { err.textContent = q.units ? "Entrez une durée entre 0 et 50 ans (600 mois)." : "Entrez un nombre entre " + q.min + " et " + q.max.toLocaleString("fr-FR") + "."; return null; }
          return { p_num: m };
        };
      } else {
        var ta = el("textarea", { maxlength: String(q.max), "aria-labelledby": qid, placeholder: "Votre phrase" });
        var cnt = el("p", { class: "count", text: "0 / " + q.max });
        ta.addEventListener("input", function () { err.textContent = ""; cnt.textContent = ta.value.length + " / " + q.max; });
        body.appendChild(ta); body.appendChild(cnt);
        getValue = function () { var t = ta.value.trim(); if (!t) { err.textContent = "Écrivez une phrase."; return null; } return { p_txt: t.slice(0, q.max) }; };
      }
      body.appendChild(send); body.appendChild(err);
      send.addEventListener("click", function () {
        var v = getValue(); if (!v) return;
        busy = true; send.disabled = true; send.textContent = "Envoi…";
        var args = { p_session: sid, p_grp: grp, p_qid: q.qid, p_pid: pid, p_num: null, p_choice: null, p_txt: null };
        for (var k in v) args[k] = v[k];
        rpc("ancrage_submit", args).then(function (res) {
          busy = false;
          if (res === "ok") { markDone(q.qid); shown = null; render(); }
          else if (res === "fermee") { markDone(q.qid); shown = null; render(); }
          else { send.disabled = false; send.textContent = "Envoyer"; err.textContent = "Réponse refusée, vérifiez-la."; }
        }, function () {
          busy = false; send.disabled = false; send.textContent = "Réessayer";
          err.textContent = "Connexion instable. Appuyez à nouveau.";
        });
      });
    }

    function poll() {
      rpc("ancrage_state", { p_session: sid }).then(function (s) {
        failures = 0;
        if (s && typeof s.unlocked === "number") { state = s; render(); }
      }, function () { failures++; }).then(function () {
        setTimeout(poll, failures ? Math.min(3000 + failures * 1000, 8000) : 3000);
      });
    }
    render(); poll();
  }

  /* ---------- Stats helpers ---------- */
  function rowsBy(res) {
    var m = {};
    (res && res.rows || []).forEach(function (r) { m[r.qid + ":" + r.grp] = r; });
    return m;
  }
  var STOP = "a à au aux avec ce ces cet cette c ça d de des du elle en est et être il ils je j l la le les leur lui ma mais me même mes moi mon ne n nos notre nous on ou où par pas pour plus qu que qui sa se ses si son sur ta te tes toi ton tu t un une vos votre vous y s si va vas fait ont as ai avez sont était quelqu quand comme alors".split(" ");
  function words(texts) {
    var c = {};
    texts.forEach(function (t) {
      String(t).toLowerCase().replace(/[’']/g, " ").split(/[^a-zàâäçéèêëîïôöùûüÿœæ0-9-]+/).forEach(function (w) {
        w = w.replace(/^-+|-+$/g, "");
        if (w.length < 3 || STOP.indexOf(w) >= 0) return;
        c[w] = (c[w] || 0) + 1;
      });
    });
    return Object.keys(c).map(function (k) { return [k, c[k]]; }).sort(function (x, y) { return y[1] - x[1]; }).slice(0, 30);
  }

  /* ---------- Régie ---------- */
  function regie(root) {
    var code = null;
    try { code = window.sessionStorage.getItem("ancrage:code"); } catch (e) {}
    var wrap = el("div", { class: "regie" });
    root.appendChild(wrap);

    function gate(msg) {
      wrap.innerHTML = "";
      var inp = el("input", { class: "num", type: "password", autocomplete: "off", placeholder: "Code régie", "aria-label": "Code régie" });
      var err = el("p", { class: "err", role: "alert", text: msg || "" });
      var go = el("button", { class: "btn", type: "button", text: "Entrer" });
      function tryIt() {
        var c = inp.value.trim(); if (!c) { err.textContent = "Entrez le code."; return; }
        go.disabled = true;
        rpc("ancrage_check", { p_code: c }).then(function (ok) {
          go.disabled = false;
          if (ok === true) { code = c; try { window.sessionStorage.setItem("ancrage:code", c); } catch (e) {} main(); }
          else err.textContent = "Code incorrect.";
        }, function () { go.disabled = false; err.textContent = "Pas de connexion, réessayez."; });
      }
      go.addEventListener("click", tryIt);
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") tryIt(); });
      wrap.appendChild(el("div", { class: "wrap", style: "min-height:auto" }, [el("p", { class: "kicker", text: "Régie" }), el("h1", { text: "Quiz live · biais d’ancrage" }), inp, go, err]));
    }

    var data = { quiz: null, jeu: null };
    var panes = {};

    function main() {
      wrap.innerHTML = "";
      wrap.appendChild(el("div", { class: "row", style: "justify-content:space-between" }, [
        el("div", null, [el("p", { class: "kicker", text: "Régie · mise à jour toutes les 2 secondes" }), el("h1", { text: "Quiz live · biais d’ancrage" })]),
        el("span", { class: "pill on", id: "live", text: "connecté" })
      ]));
      ["quiz", "jeu"].forEach(function (sid) {
        var p = el("section", { "aria-label": SESSIONS[sid].title });
        panes[sid] = p; wrap.appendChild(p);
      });
      tick();
    }

    function setUnlocked(sid, n) {
      rpc("ancrage_set", { p_code: code, p_session: sid, p_unlocked: n }).then(function (r) {
        if (r === "code") { code = null; gate("Code expiré, entrez-le à nouveau."); return; }
        tick(true);
      }, function () { alert("Pas de connexion : l’ouverture n’a pas été prise en compte."); });
    }
    function reset(sid) {
      if (!window.confirm("Effacer toutes les réponses de « " + SESSIONS[sid].title + " » ? À faire seulement après les tests, avant le cours.")) return;
      rpc("ancrage_reset", { p_code: code, p_session: sid }).then(function () { tick(true); }, function () { alert("Pas de connexion, réessayez."); });
    }

    function draw(sid) {
      var S = SESSIONS[sid], res = data[sid], p = panes[sid];
      if (!res) return;
      var by = rowsBy(res), gk = Object.keys(S.groups);
      p.innerHTML = "";
      var base = location.pathname.replace(/regie\/?(index\.html)?$/, "");
      p.appendChild(el("div", { class: "row", style: "justify-content:space-between;margin-top:26px" }, [
        el("h2", { style: "margin:0", text: S.title + (sid === "quiz" ? " (QR gauche /a, QR droit /b)" : " (QR /j)") }),
        el("div", { class: "row" }, [
          el("button", { class: "sbtn", type: "button", text: "Tout fermer", onclick: function () { setUnlocked(sid, 0); } }),
          el("button", { class: "sbtn", type: "button", text: "Tout ouvrir", onclick: function () { setUnlocked(sid, S.questions.length); } }),
          el("button", { class: "sbtn", type: "button", text: "Remettre à zéro", onclick: function () { reset(sid); } })
        ])
      ]));
      S.questions.forEach(function (q, i) {
        var open = i < res.unlocked, live = sid === "jeu";
        var isCur = live ? i === res.unlocked - 1 : open;
        var card = el("div", { class: "card" });
        card.appendChild(el("div", { class: "row", style: "justify-content:space-between" }, [
          el("div", { class: "row" }, [el("span", { class: "pill" + (isCur ? " on" : ""), text: isCur ? "OUVERTE" : (open ? "passée" : "fermée") }), el("strong", { text: (i + 1) + ". " + (q.short || pick(q.text, "a")) })]),
          el("div", { class: "row" }, [
            live ? el("button", { class: "sbtn" + (isCur ? "" : " main"), type: "button", text: isCur ? "Ouverte" : "Ouvrir celle-ci", onclick: function () { setUnlocked(sid, i + 1); } }) : null,
            el("a", { class: "sbtn", href: base + "ecran/?q=" + sid + ":" + q.qid, target: "_blank", rel: "noopener", text: "Projeter" })
          ])
        ]));
        var g = el("div", { class: gk.length > 1 ? "grid2" : "" , style: "margin-top:10px" });
        gk.forEach(function (k) {
          var r = by[q.qid + ":" + k] || { n: 0 };
          var box = el("div");
          if (gk.length > 1) box.appendChild(el("p", { class: "stat", text: S.groups[k] }));
          if (q.kind === "number") {
            box.appendChild(el("p", { style: "margin:4px 0" }, [el("span", { class: "big", text: fmt(r.mean) + (q.units ? " mois" : "") }), el("span", { class: "stat", text: (q.units && r.mean != null ? "  soit " + ans(r.mean) : "") + "  moyenne · médiane " + fmt(r.median) + " · " + rep(r.n) + " · min " + fmt(r.min) + " · max " + fmt(r.max) })]));
          } else if (q.kind === "choice") {
            var tot = r.n || 0;
            pick(q.choices, k).forEach(function (c) {
              var v = (r.counts || {})[c[0]] || 0, pc = tot ? Math.round(100 * v / tot) : 0;
              box.appendChild(el("div", { class: "row", style: "gap:10px;margin:4px 0" }, [el("span", { class: "stat", style: "width:230px", text: c[1] }), el("div", { class: "bar", style: "width:" + (pc * 2) + "px" }), el("span", { class: "stat", text: pc + " % (" + v + ")" })]));
            });
            box.appendChild(el("p", { class: "small", text: rep(tot) }));
          } else {
            box.appendChild(el("p", { class: "stat", text: rep(r.n) }));
            (r.texts || []).slice(0, 8).forEach(function (t) { box.appendChild(el("p", { class: "small", style: "margin:4px 0", text: "« " + t + " »" })); });
          }
          g.appendChild(box);
        });
        card.appendChild(g);
        p.appendChild(card);
      });
    }

    var timer = null, lastSig = "", pressing = false;
    document.addEventListener("pointerdown", function () { pressing = true; });
    document.addEventListener("pointerup", function () { setTimeout(function () { pressing = false; }, 300); });
    document.addEventListener("pointercancel", function () { pressing = false; });
    function tick(now) {
      clearTimeout(timer);
      Promise.all([rpc("ancrage_results", { p_session: "quiz" }), rpc("ancrage_results", { p_session: "jeu" })]).then(function (rs) {
        data.quiz = rs[0]; data.jeu = rs[1];
        var lv = document.getElementById("live"); if (lv) { lv.textContent = "connecté"; lv.className = "pill on"; }
        var sig = JSON.stringify(rs);
        if (!busyFocus() && !pressing && (now || sig !== lastSig)) { lastSig = sig; draw("quiz"); draw("jeu"); }
      }, function () {
        var lv = document.getElementById("live"); if (lv) { lv.textContent = "connexion perdue…"; lv.className = "pill"; }
      }).then(function () { timer = setTimeout(tick, 2000); });
    }
    function busyFocus() { var a = document.activeElement; return a && a.tagName === "INPUT"; }

    if (code) {
      rpc("ancrage_check", { p_code: code }).then(function (ok) { if (ok === true) main(); else gate(); }, function () { gate("Pas de connexion, réessayez."); });
    } else gate();
  }

  /* ---------- Écran ---------- */
  function ecran(root) {
    var params = new URLSearchParams(location.search);
    var items = (params.get("q") || "quiz:q4").split(",").map(function (s) { var a = s.split(":"); return { sid: a[0], qid: a[1] }; })
      .filter(function (it) { return SESSIONS[it.sid] && SESSIONS[it.sid].questions.some(function (q) { return q.qid === it.qid; }); });
    var wrap = el("div", { class: "ecran" });
    root.appendChild(wrap);
    if (!items.length) { wrap.appendChild(el("h1", { text: "Question inconnue" })); return; }
    var sids = items.map(function (i) { return i.sid; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var data = {}, lastSig = "";
    function qOf(it) { return SESSIONS[it.sid].questions.filter(function (q) { return q.qid === it.qid; })[0]; }
    function draw() {
      wrap.innerHTML = "";
      var first = qOf(items[0]), S = SESSIONS[items[0].sid];
      var title = items.length > 1 ? "Avant / après" : (items[0].sid === "quiz" && first.qid === "q4" ? "Même question, deux ancres" : (first.short || pick(first.text, "a")));
      wrap.appendChild(el("div", null, [el("p", { class: "kicker", text: S.title }), el("h1", { text: title })]));
      var cols = el("div", { class: "cols" });
      items.forEach(function (it, ii) {
        var q = qOf(it), Sx = SESSIONS[it.sid], by = rowsBy(data[it.sid]);
        Object.keys(Sx.groups).forEach(function (k) {
          var r = by[q.qid + ":" + k] || { n: 0, counts: {}, texts: [] };
          var label = items.length > 1 ? (ii === 0 ? "Avant" : "Après") : (Object.keys(Sx.groups).length > 1 ? Sx.groups[k] : "");
          if (it.sid === "quiz" && q.qid === "q4") label = Sx.groups[k] + " · ancre " + (k === "a" ? "3 mois" : "10 ans");
          var col = el("div", { class: "col" });
          if (label) col.appendChild(el("p", { class: "kicker", style: "font-size:20px", text: label }));
          if (q.kind === "number") {
            col.appendChild(el("p", { class: "huge", style: "margin:10px 0", text: fmt(r.mean) }));
            if (q.units && r.mean != null) col.appendChild(el("p", { style: "font-size:40px;margin:0 0 6px", text: "soit " + ans(r.mean) }));
            col.appendChild(el("p", { class: "mono", style: "font-size:24px;color:var(--grey)", text: q.unit + " en moyenne · médiane " + fmt(r.median) + " · " + rep(r.n) }));
          } else if (q.kind === "choice") {
            var tot = r.n || 0;
            pick(q.choices, k).forEach(function (c) {
              var v = (r.counts || {})[c[0]] || 0, pc = tot ? Math.round(100 * v / tot) : 0;
              col.appendChild(el("div", { class: "ebar" }, [el("span", { style: "width:260px", text: c[1] }), el("div", { class: "bar", style: "width:" + Math.max(pc * 6, 4) + "px" }), el("span", { class: "mono", text: pc + " %" })]));
            });
            col.appendChild(el("p", { class: "mono", style: "font-size:22px;color:var(--grey)", text: rep(tot) }));
          } else {
            var ws = words(r.texts || []), maxc = ws.length ? ws[0][1] : 1;
            var cloud = el("div", { class: "ewords" });
            ws.forEach(function (w, wi) { cloud.appendChild(el("span", { style: "font-size:" + Math.round(26 + 70 * w[1] / maxc) + "px;color:" + (wi < 3 ? "var(--orange)" : "var(--cream)"), text: w[0] })); });
            col.appendChild(cloud);
            (r.texts || []).slice(0, 4).forEach(function (t) { col.appendChild(el("p", { style: "font-size:28px;font-style:italic;margin:10px 0", text: "« " + t + " »" })); });
            col.appendChild(el("p", { class: "mono", style: "font-size:22px;color:var(--grey)", text: rep(r.n) }));
          }
          cols.appendChild(col);
        });
      });
      wrap.appendChild(cols);
    }
    function tick() {
      Promise.all(sids.map(function (s) { return rpc("ancrage_results", { p_session: s }); })).then(function (rs) {
        var sig = JSON.stringify(rs);
        if (sig !== lastSig) { lastSig = sig; rs.forEach(function (r, i) { data[sids[i]] = r; }); draw(); }
      }, function () {}).then(function () { setTimeout(tick, 2000); });
    }
    tick();
  }

  window.Ancrage = { participant: participant, regie: regie, ecran: ecran };
})();
