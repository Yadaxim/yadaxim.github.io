(function (global) {
  var PATH_COMMANDS = { ls: true, cd: true, cat: true };

  function toLines(value) {
    if (value == null) return [];
    if (Array.isArray(value)) return value.map(String);
    return [String(value)];
  }

  function longestCommonPrefix(strings) {
    if (!strings || strings.length === 0) {
      return "";
    }
    var s0 = strings[0];
    var i;
    var j;
    for (i = 1; i < strings.length; i++) {
      var b = strings[i];
      j = 0;
      while (j < s0.length && j < b.length && s0.charAt(j) === b.charAt(j)) {
        j++;
      }
      s0 = s0.slice(0, j);
      if (s0 === "") {
        return "";
      }
    }
    return s0;
  }

  function FakeTerminal(options) {
    if (!options || !options.mount) {
      throw new Error("FakeTerminal requires a mount element.");
    }

    this.mount = options.mount;
    this.prompt = options.prompt || "guest@site:~$";
    this.welcome = Array.isArray(options.welcome) ? options.welcome : [];
    this.autofocus = options.autofocus !== false; // false: don't grab focus (and scroll) on load
    this.history = [];
    this.historyIndex = 0;
    this.commands = Object.assign({}, options.commands || {});
    this.promptHost = options.promptHost;
    this.builtinCommands = {
      help: this.helpCommand.bind(this),
      clear: this.clearCommand.bind(this),
    };

    if (options.filesystem && typeof VirtualFS !== "undefined") {
      this.vfs = new VirtualFS(options.filesystem, {
        home: options.fsHome,
        start: options.fsStart,
      });
      this.builtinCommands.ls = this.shellLs.bind(this);
      this.builtinCommands.cd = this.shellCd.bind(this);
      this.builtinCommands.cat = this.shellCat.bind(this);
      this.builtinCommands.pwd = this.shellPwd.bind(this);
    } else if (options.filesystem) {
      throw new Error("FakeTerminal: load vfs.js before fake-terminal.js when using filesystem.");
    }
  }

  FakeTerminal.prototype.start = function () {
    this.mount.innerHTML = "";
    this.mount.classList.add("fake-terminal");

    this.outputEl = document.createElement("div");
    this.outputEl.className = "terminal-output";
    this.mount.appendChild(this.outputEl);

    this.inputRow = document.createElement("label");
    this.inputRow.className = "terminal-input-row";
    this.mount.appendChild(this.inputRow);

    this.promptEl = document.createElement("span");
    this.promptEl.className = "terminal-prompt";
    this.promptEl.textContent = this.getPrompt();
    this.inputRow.appendChild(this.promptEl);

    this.inputEl = document.createElement("input");
    this.inputEl.className = "terminal-input";
    this.inputEl.type = "text";
    this.inputEl.autocomplete = "off";
    this.inputEl.spellcheck = false;
    this.inputRow.appendChild(this.inputEl);

    this.bindEvents();
    this.welcome.forEach(this.printLine.bind(this));
    if (this.autofocus) this.inputEl.focus();
  };

  FakeTerminal.prototype.bindEvents = function () {
    this.inputEl.addEventListener("keydown", this.handleKeydown.bind(this));
    this.mount.addEventListener("click", function () {
      this.inputEl.focus();
    }.bind(this));
  };

  FakeTerminal.prototype.handleKeydown = function (event) {
    if (event.key === "Enter") {
      const raw = this.inputEl.value.trim();
      this.printLine(this.getPrompt() + " " + raw, true);
      this.inputEl.value = "";

      if (raw.length > 0) {
        this.history.push(raw);
      }
      this.historyIndex = this.history.length;

      this.runCommand(raw);
      return;
    }

    if (event.key === "ArrowUp") {
      if (this.historyIndex > 0) {
        this.historyIndex -= 1;
        this.inputEl.value = this.history[this.historyIndex] || "";
      }
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowDown") {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex += 1;
        this.inputEl.value = this.history[this.historyIndex] || "";
      } else {
        this.historyIndex = this.history.length;
        this.inputEl.value = "";
      }
      event.preventDefault();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      this.handleTabCompletion();
    }
  };

  FakeTerminal.prototype.tokenAtCursor = function (line, cursor) {
    var left = line.slice(0, cursor);
    var m = left.match(/(?:^|\s)(\S*)$/);
    if (!m) {
      return { start: cursor, end: cursor, text: "" };
    }
    var token = m[1];
    var tokenStart = left.length - token.length;
    return { start: tokenStart, end: cursor, text: token };
  };

  FakeTerminal.prototype.firstWordLower = function (line) {
    var trimmed = line.replace(/^\s+/, "");
    var space = trimmed.indexOf(" ");
    if (space === -1) {
      return trimmed.toLowerCase();
    }
    return trimmed.slice(0, space).toLowerCase();
  };

  FakeTerminal.prototype.commandCompletionCandidates = function (partial) {
    partial = (partial || "").toLowerCase();
    var names = Object.keys(this.commands).concat(Object.keys(this.builtinCommands));
    var seen = {};
    var lowerUnique = [];
    var i;
    for (i = 0; i < names.length; i++) {
      var lk = names[i].toLowerCase();
      if (!seen[lk]) {
        seen[lk] = true;
        lowerUnique.push(lk);
      }
    }
    lowerUnique.sort();
    return lowerUnique.filter(function (n) {
      return n.indexOf(partial) === 0;
    });
  };

  FakeTerminal.prototype.handleTabCompletion = function () {
    var input = this.inputEl;
    var line = input.value;
    var cursor =
      input.selectionStart != null ? input.selectionStart : line.length;
    var tok = this.tokenAtCursor(line, cursor);
    var beforeTok = line.slice(0, tok.start);
    var trimmedBefore = beforeTok.replace(/^\s+/, "");
    var isFirstToken = trimmedBefore.indexOf(" ") === -1;

    var candidates;
    if (!this.vfs || isFirstToken) {
      candidates = this.commandCompletionCandidates(tok.text);
    } else {
      var cmd = this.firstWordLower(line);
      if (!PATH_COMMANDS[cmd]) {
        return;
      }
      candidates = this.vfs.tabComplete(tok.text).candidates;
    }

    if (candidates.length === 0) {
      return;
    }

    var lcp = longestCommonPrefix(candidates);
    var nextText = tok.text;

    if (lcp.length > tok.text.length) {
      nextText = lcp;
    } else if (candidates.length === 1) {
      nextText = candidates[0];
    } else {
      this.printLine(candidates.join("  "));
      return;
    }

    var newLine = line.slice(0, tok.start) + nextText + line.slice(cursor);
    input.value = newLine;
    var newCursor = tok.start + nextText.length;
    input.setSelectionRange(newCursor, newCursor);
  };

  FakeTerminal.prototype.runCommand = function (input) {
    if (!input) return;

    const parts = input.split(/\s+/);
    const name = parts[0].toLowerCase();
    const args = parts.slice(1);

    const commandFn = this.commands[name] || this.builtinCommands[name];
    if (!commandFn) {
      this.printLine("Command not found: " + name + ". Type 'help'.");
      return;
    }

    const result = commandFn(args, input);
    toLines(result).forEach(this.printLine.bind(this));
  };

  FakeTerminal.prototype.helpCommand = function () {
    const names = Object.keys(this.commands)
      .concat(Object.keys(this.builtinCommands))
      .sort();
    return [
      "Available commands:",
      names.map(function (name) {
        return "- " + name;
      }).join("\n"),
    ];
  };

  FakeTerminal.prototype.clearCommand = function () {
    this.outputEl.innerHTML = "";
    return [];
  };

  FakeTerminal.prototype.getPrompt = function () {
    if (this.vfs) {
      var host = this.promptHost || "guest@site";
      return host + ":" + this.displayPath(this.vfs.pwd()) + "$";
    }
    return this.prompt;
  };

  // Show the home directory as "~", like a real shell: /home/visitor/projects -> ~/projects
  FakeTerminal.prototype.displayPath = function (path) {
    var home = "/" + this.vfs.homeParts.join("/");
    if (path === home) return "~";
    if (path.indexOf(home + "/") === 0) return "~" + path.slice(home.length);
    return path;
  };

  FakeTerminal.prototype.refreshPrompt = function () {
    if (this.promptEl) {
      this.promptEl.textContent = this.getPrompt();
    }
  };

  FakeTerminal.prototype.shellLs = function (args) {
    var r = this.vfs.ls(args[0]);
    if (!r.ok) {
      return r.error;
    }
    if (r.lines.length === 0) {
      return "";
    }
    return r.lines.join("  ");
  };

  FakeTerminal.prototype.shellCd = function (args) {
    var r = this.vfs.cd(args[0]);
    if (!r.ok) {
      return r.error;
    }
    this.refreshPrompt();
    return [];
  };

  FakeTerminal.prototype.shellCat = function (args) {
    var r = this.vfs.cat(args[0]);
    if (!r.ok) {
      return r.error;
    }
    return r.lines;
  };

  FakeTerminal.prototype.shellPwd = function () {
    return this.vfs.pwd();
  };

  FakeTerminal.prototype.printLine = function (line, isEcho) {
    const row = document.createElement("div");
    row.className = "terminal-line" + (isEcho ? " terminal-echo" : "");
    row.textContent = line;
    this.outputEl.appendChild(row);
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  };

  global.FakeTerminal = FakeTerminal;
})(window);
