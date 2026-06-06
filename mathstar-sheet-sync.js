(function () {
  if (window.MathStarSheetSync) return;

  const CONFIG = {
    student: "Lucas",
    webAppUrl: "",
    appName: "MathStar"
  };

  const STORAGE = {
    endpoint: "mathstar_google_sheet_web_app_url_v1",
    student: "mathstar_student_name_v1",
    queue: "mathstar_google_sheet_queue_v1"
  };

  const SESSION_ID = [
    "mathstar",
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 10)
  ].join("-");
  let attemptCounter = 0;
  let isFlushing = false;
  let lastAttempt = { signature: "", time: 0 };

  function readJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Keep the practice flow smooth even if storage is full or disabled.
    }
  }

  function getEndpoint() {
    return (
      localStorage.getItem(STORAGE.endpoint) ||
      CONFIG.webAppUrl ||
      ""
    ).trim();
  }

  function getStudent() {
    return (
      localStorage.getItem(STORAGE.student) ||
      CONFIG.student ||
      "Lucas"
    ).trim();
  }

  function storeSetupFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const endpoint =
      params.get("sheetWebhook") ||
      params.get("sheetUrl") ||
      params.get("googleSheetUrl");
    const student = params.get("student");

    if (endpoint) {
      localStorage.setItem(STORAGE.endpoint, endpoint.trim());
    }
    if (student) {
      localStorage.setItem(STORAGE.student, student.trim());
    }
    if (endpoint || student) {
      params.delete("sheetWebhook");
      params.delete("sheetUrl");
      params.delete("googleSheetUrl");
      params.delete("student");
      const query = params.toString();
      const cleanUrl =
        window.location.pathname +
        (query ? "?" + query : "") +
        window.location.hash;
      window.history.replaceState(null, "", cleanUrl);
    }
  }

  function loadQueue() {
    return readJson(STORAGE.queue, []);
  }

  function saveQueue(queue) {
    writeJson(STORAGE.queue, queue.slice(-300));
  }

  function enqueue(record) {
    const queue = loadQueue();
    queue.push(record);
    saveQueue(queue);
    flushQueue();
  }

  async function sendRecord(record) {
    const endpoint = getEndpoint();
    if (!endpoint) return false;

    try {
      await fetch(endpoint, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ records: [record] })
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async function flushQueue() {
    if (isFlushing || !getEndpoint()) return;
    isFlushing = true;

    try {
      while (true) {
        const queue = loadQueue();
        if (!queue.length) break;

        const sent = await sendRecord(queue[0]);
        if (!sent) break;

        saveQueue(queue.slice(1));
      }
    } finally {
      isFlushing = false;
    }
  }

  function parseProblem(text) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    const match = normalized.match(
      /^(\d+)\s*([+\-\u2212\u00d7x*\/\u00f7])\s*(\d+)(?:\s*([+\-\u2212\u00d7x*\/\u00f7])\s*(\d+))?\s*=\s*\?$/
    );

    if (!match) return null;

    const number1 = Number(match[1]);
    const symbol = match[2];
    const number2 = Number(match[3]);
    const secondSymbol = match[4] || "";
    const number3 = match[5] === undefined ? null : Number(match[5]);
    let operation = "";
    let expectedAnswer = NaN;
    const hasThirdNumber = number3 !== null;

    if (hasThirdNumber && secondSymbol !== symbol) return null;

    if (symbol === "+") {
      operation = hasThirdNumber ? "add3" : "add";
      expectedAnswer = number1 + number2 + (hasThirdNumber ? number3 : 0);
    } else if (symbol === "-" || symbol === "\u2212") {
      operation = hasThirdNumber ? "sub3" : "sub";
      expectedAnswer = number1 - number2 - (hasThirdNumber ? number3 : 0);
    } else if (symbol === "x" || symbol === "*" || symbol === "\u00d7") {
      if (hasThirdNumber) return null;
      operation = "mul";
      expectedAnswer = number1 * number2;
    } else if (symbol === "/" || symbol === "\u00f7") {
      if (hasThirdNumber) return null;
      operation = "div";
      expectedAnswer = number1 / number2;
    }

    if (!Number.isFinite(expectedAnswer)) return null;

    return {
      number1,
      number2,
      number3,
      left: number1,
      right: number2,
      symbol,
      operation,
      expectedAnswer,
      problem: hasThirdNumber
        ? `${number1} ${symbol} ${number2} ${symbol} ${number3} = ?`
        : `${number1} ${symbol} ${number2} = ?`
    };
  }

  function getCurrentProblem() {
    const root = document.getElementById("root");
    if (!root) return null;

    const candidates = Array.from(root.querySelectorAll("*"))
      .map((element) => String(element.textContent || "").trim())
      .map((text) => text.replace(/\s+/g, " "))
      .filter(
        (text) =>
          text.length <= 80 && text.indexOf("=") >= 0 && text.indexOf("?") >= 0
      )
      .sort((a, b) => a.length - b.length);

    for (const text of candidates) {
      const problem = parseProblem(text);
      if (problem) return problem;
    }

    return null;
  }

  function getQuestionNumber() {
    const root = document.getElementById("root");
    const text = root ? root.textContent || "" : "";
    const match = text.match(/Question #\s*(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function getSettingsSnapshot(problem) {
    const root = document.getElementById("root");
    const text = root ? root.textContent || "" : "";
    const maxDigitsMatch = text.match(/Numbers from 1 to (9{1,4})/);

    return {
      maxDigits: maxDigitsMatch ? maxDigitsMatch[1].length : null,
      visibleOperation: problem ? problem.operation : null
    };
  }

  function recordCurrentAttempt(source) {
    const input = document.querySelector('#root input[type="number"]');
    if (!input || input.disabled) return;

    const rawAnswer = String(input.value || "").trim();
    if (!rawAnswer) return;

    const studentAnswer = parseInt(rawAnswer, 10);
    if (!Number.isFinite(studentAnswer)) return;

    const problem = getCurrentProblem();
    if (!problem) return;

    const questionNumber = getQuestionNumber();
    const signature = [questionNumber, problem.problem, rawAnswer].join("|");
    const now = Date.now();
    if (lastAttempt.signature === signature && now - lastAttempt.time < 700) {
      return;
    }
    lastAttempt = { signature, time: now };

    const settings = getSettingsSnapshot(problem);
    const isCorrect = studentAnswer === problem.expectedAnswer;
    attemptCounter += 1;

    enqueue({
      timestamp: new Date().toISOString(),
      clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      student: getStudent(),
      result: isCorrect ? "correct" : "wrong",
      problem: problem.problem,
      operation: problem.operation,
      number1: problem.number1,
      number2: problem.number2,
      number3: problem.number3,
      expectedAnswer: problem.expectedAnswer,
      studentAnswer,
      settings
    });
  }

  function isCheckButton(target) {
    const button = target && target.closest ? target.closest("button") : null;
    return !!button && String(button.textContent || "").indexOf("Check") >= 0;
  }

  document.addEventListener(
    "click",
    function (event) {
      if (isCheckButton(event.target)) {
        recordCurrentAttempt("check-button");
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    function (event) {
      const target = event.target;
      if (
        event.key === "Enter" &&
        target &&
        target.matches &&
        target.matches('#root input[type="number"]')
      ) {
        recordCurrentAttempt("enter-key");
      }
    },
    true
  );

  window.addEventListener("online", flushQueue);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) flushQueue();
  });

  window.MathStarSheetSync = {
    setUrl(url) {
      localStorage.setItem(STORAGE.endpoint, String(url || "").trim());
      return flushQueue();
    },
    setStudent(name) {
      localStorage.setItem(STORAGE.student, String(name || "").trim());
    },
    status() {
      return {
        configured: !!getEndpoint(),
        queued: loadQueue().length,
        student: getStudent(),
        sessionId: SESSION_ID
      };
    },
    flush: flushQueue,
    recordAttempt: enqueue
  };

  storeSetupFromQuery();
  flushQueue();
})();
