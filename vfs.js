(function (global) {
  /**
   * Virtual directory tree (JSON-friendly):
   * { type: "dir", children: { name: Node, ... } }
   * { type: "file", content: string }
   *
   * Paths use UNIX-like rules: /, ., .., ~, ~/...
   */
  function VirtualFS(rootTree, options) {
    options = options || {};
    if (!rootTree || rootTree.type !== "dir" || !rootTree.children) {
      throw new Error("VirtualFS root must be { type: 'dir', children: { ... } }");
    }
    this.root = rootTree;
    this.homeParts = splitPath(options.home || "/home/visitor");
    var start = options.start !== undefined ? options.start : "~";
    if (start === "~") {
      this.cwd = this.homeParts.slice();
    } else if (start === "/") {
      this.cwd = [];
    } else {
      this.cwd = this.normalizeFrom([], start, this.homeParts);
    }
    if (!this.resolveParts(this.cwd)) {
      this.cwd = this.homeParts.slice();
    }
  }

  function splitPath(str) {
    return str.split("/").filter(function (s) {
      return s.length > 0;
    });
  }

  VirtualFS.prototype.normalizeFrom = function (cwdParts, pathStr, homeParts) {
    var parts;
    if (pathStr == null || pathStr === "") {
      return cwdParts.slice();
    }
    if (pathStr === "~") {
      parts = homeParts.slice();
    } else if (pathStr.indexOf("~/") === 0) {
      parts = homeParts.concat(splitPath(pathStr.slice(2)));
    } else if (pathStr.charAt(0) === "/") {
      parts = splitPath(pathStr);
    } else {
      parts = cwdParts.concat(splitPath(pathStr));
    }
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p === "..") {
        out.pop();
      } else if (p !== ".") {
        out.push(p);
      }
    }
    return out;
  };

  VirtualFS.prototype.resolveParts = function (parts) {
    var node = this.root;
    for (var i = 0; i < parts.length; i++) {
      var seg = parts[i];
      if (!node.children || !node.children[seg]) {
        return null;
      }
      node = node.children[seg];
    }
    return node;
  };

  VirtualFS.prototype.resolvePath = function (pathStr) {
    var parts = this.normalizeFrom(this.cwd, pathStr, this.homeParts);
    return { parts: parts, node: this.resolveParts(parts) };
  };

  VirtualFS.prototype.pwd = function () {
    if (this.cwd.length === 0) {
      return "/";
    }
    return "/" + this.cwd.join("/");
  };

  VirtualFS.prototype.cd = function (arg) {
    var target = arg == null || arg === "" ? "~" : arg;
    var parts = this.normalizeFrom(this.cwd, target, this.homeParts);
    var node = this.resolveParts(parts);
    if (!node) {
      return { ok: false, error: "cd: no such file or directory: " + target };
    }
    if (node.type !== "dir") {
      return { ok: false, error: "cd: not a directory: " + target };
    }
    this.cwd = parts;
    return { ok: true };
  };

  VirtualFS.prototype.ls = function (arg) {
    var parts;
    var node;
    var label;
    if (!arg) {
      parts = this.cwd.slice();
      node = this.resolveParts(parts);
      label = null;
    } else {
      var r = this.resolvePath(arg);
      parts = r.parts;
      node = r.node;
      label = arg;
    }
    if (!node) {
      return {
        ok: false,
        error: "ls: cannot access '" + (label || "") + "': No such file or directory",
      };
    }
    if (node.type === "file") {
      var name = parts.length ? parts[parts.length - 1] : "";
      return { ok: true, lines: [name] };
    }
    var names = Object.keys(node.children || {}).sort();
    return { ok: true, lines: names };
  };

  VirtualFS.prototype.cat = function (arg) {
    if (!arg) {
      return { ok: false, error: "cat: missing operand" };
    }
    var r = this.resolvePath(arg);
    if (!r.node) {
      return { ok: false, error: "cat: " + arg + ": No such file or directory" };
    }
    if (r.node.type === "dir") {
      return { ok: false, error: "cat: " + arg + ": Is a directory" };
    }
    var body = r.node.content != null ? String(r.node.content) : "";
    return { ok: true, lines: body.split(/\r?\n/) };
  };

  /**
   * Tab-completion candidates for a partial path token (relative or absolute, ~/).
   * Directory matches include a trailing slash.
   */
  VirtualFS.prototype.tabComplete = function (partial) {
    partial = partial != null ? String(partial) : "";
    var idx = partial.lastIndexOf("/");
    var dirToken;
    var base;
    if (idx === -1) {
      dirToken = "";
      base = partial;
    } else {
      dirToken = partial.slice(0, idx);
      base = partial.slice(idx + 1);
    }

    var dirNode;
    if (dirToken === "") {
      dirNode = this.resolveParts(this.cwd.slice());
    } else {
      var res = this.resolvePath(dirToken);
      if (!res.node || res.node.type !== "dir") {
        return { candidates: [] };
      }
      dirNode = res.node;
    }

    var names = Object.keys(dirNode.children || {}).sort();
    var filtered = names.filter(function (n) {
      return n.indexOf(base) === 0;
    });

    var candidates = filtered.map(function (name) {
      var child = dirNode.children[name];
      var tail = dirToken === "" ? name : dirToken + "/" + name;
      if (child.type === "dir") {
        tail += "/";
      }
      return tail;
    });

    return { candidates: candidates };
  };

  global.VirtualFS = VirtualFS;
})(window);
