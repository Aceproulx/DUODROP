/* ================================================================
   DUODROP — ZodDD Validation Library
   A lightweight Zod-compatible schema validation engine.
   Mirrors Zod's API: z.string(), z.number(), z.object(), etc.
   Used throughout the app for form validation and API contracts.
   ================================================================ */

const z = (() => {
  // ── Base result helpers ──────────────────────────────────────
  const ok  = (value)          => ({ success: true,  data:  value });
  const err = (issues)         => ({ success: false, error: { issues } });
  const mkIssue = (path, msg)  => ({ path, message: msg });

  // ── Base schema class ────────────────────────────────────────
  class ZSchema {
    constructor() {
      this._checks   = [];
      this._optional = false;
      this._nullable = false;
      this._default  = undefined;
      this._desc     = '';
    }

    optional()      { const s = this._clone(); s._optional = true;  return s; }
    nullable()      { const s = this._clone(); s._nullable = true;  return s; }
    default(val)    { const s = this._clone(); s._default  = val;   return s; }
    describe(d)     { const s = this._clone(); s._desc     = d;     return s; }

    _clone() {
      const clone = Object.create(Object.getPrototypeOf(this));
      Object.assign(clone, this);
      clone._checks = [...this._checks];
      return clone;
    }

    _addCheck(fn) {
      const s = this._clone();
      s._checks.push(fn);
      return s;
    }

    _runChecks(value, path) {
      const issues = [];
      for (const check of this._checks) {
        const r = check(value, path);
        if (r) issues.push(r);
      }
      return issues;
    }

    safeParse(value) {
      // Handle undefined / null
      if (value === undefined || value === null || value === '') {
        if (this._default !== undefined) value = this._default;
        else if (this._optional || this._nullable) return ok(value ?? null);
        else return err([mkIssue('', 'Required')]);
      }
      return this._parse(value, '');
    }

    parse(value) {
      const r = this.safeParse(value);
      if (!r.success) throw new ZodError(r.error.issues);
      return r.data;
    }
  }

  // ── ZodError ─────────────────────────────────────────────────
  class ZodError extends Error {
    constructor(issues) {
      super(issues.map(i => i.message).join('; '));
      this.issues = issues;
      this.name   = 'ZodError';
    }
    flatten() {
      const fieldErrors  = {};
      const formErrors   = [];
      this.issues.forEach(i => {
        if (i.path) fieldErrors[i.path] = (fieldErrors[i.path] || []).concat(i.message);
        else        formErrors.push(i.message);
      });
      return { fieldErrors, formErrors };
    }
  }

  // ── ZString ──────────────────────────────────────────────────
  class ZString extends ZSchema {
    _parse(value, path) {
      if (typeof value !== 'string') return err([mkIssue(path, 'Expected string')]);
      const issues = this._runChecks(value, path);
      return issues.length ? err(issues) : ok(value);
    }
    min(n, msg)       { return this._addCheck((v, p) => v.length < n    ? mkIssue(p, msg || `Min ${n} character(s)`) : null); }
    max(n, msg)       { return this._addCheck((v, p) => v.length > n    ? mkIssue(p, msg || `Max ${n} character(s)`) : null); }
    length(n, msg)    { return this._addCheck((v, p) => v.length !== n  ? mkIssue(p, msg || `Must be ${n} character(s)`) : null); }
    email(msg)        { return this._addCheck((v, p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : mkIssue(p, msg || 'Invalid email address')); }
    url(msg)          { return this._addCheck((v, p) => { try { new URL(v); return null; } catch { return mkIssue(p, msg || 'Invalid URL'); } }); }
    regex(re, msg)    { return this._addCheck((v, p) => re.test(v) ? null : mkIssue(p, msg || 'Invalid format')); }
    startsWith(s,msg) { return this._addCheck((v, p) => v.startsWith(s) ? null : mkIssue(p, msg || `Must start with "${s}"`)); }
    endsWith(s, msg)  { return this._addCheck((v, p) => v.endsWith(s)   ? null : mkIssue(p, msg || `Must end with "${s}"`)); }
    trim()            { return this._addCheck((v)    => { /* mutate */ }); } // passthrough, user should trim input
    nonempty(msg)     { return this.min(1, msg || 'Cannot be empty'); }
    includes(s, msg)  { return this._addCheck((v, p) => v.includes(s) ? null : mkIssue(p, msg || `Must include "${s}"`)); }
  }

  // ── ZNumber ──────────────────────────────────────────────────
  class ZNumber extends ZSchema {
    _parse(value, path) {
      const n = typeof value === 'string' ? parseFloat(value) : value;
      if (typeof n !== 'number' || isNaN(n)) return err([mkIssue(path, 'Expected number')]);
      const issues = this._runChecks(n, path);
      return issues.length ? err(issues) : ok(n);
    }
    min(n, msg)       { return this._addCheck((v, p) => v < n  ? mkIssue(p, msg || `Min value: ${n}`) : null); }
    max(n, msg)       { return this._addCheck((v, p) => v > n  ? mkIssue(p, msg || `Max value: ${n}`) : null); }
    int(msg)          { return this._addCheck((v, p) => Number.isInteger(v) ? null : mkIssue(p, msg || 'Must be an integer')); }
    positive(msg)     { return this._addCheck((v, p) => v > 0  ? null : mkIssue(p, msg || 'Must be positive')); }
    nonnegative(msg)  { return this._addCheck((v, p) => v >= 0 ? null : mkIssue(p, msg || 'Must be 0 or greater')); }
    multipleOf(n,msg) { return this._addCheck((v, p) => v % n === 0 ? null : mkIssue(p, msg || `Must be multiple of ${n}`)); }
  }

  // ── ZBoolean ─────────────────────────────────────────────────
  class ZBoolean extends ZSchema {
    _parse(value, path) {
      if (value === true || value === false) return ok(value);
      if (value === 'true')  return ok(true);
      if (value === 'false') return ok(false);
      return err([mkIssue(path, 'Expected boolean')]);
    }
    refine(fn, msg)   { return this._addCheck((v, p) => fn(v) ? null : mkIssue(p, msg || 'Validation failed')); }
  }

  // ── ZEnum ────────────────────────────────────────────────────
  class ZEnum extends ZSchema {
    constructor(values) { super(); this._values = values; }
    _parse(value, path) {
      if (!this._values.includes(value)) {
        return err([mkIssue(path, `Must be one of: ${this._values.join(', ')}`)]);
      }
      return ok(value);
    }
  }

  // ── ZLiteral ─────────────────────────────────────────────────
  class ZLiteral extends ZSchema {
    constructor(lit) { super(); this._lit = lit; }
    _parse(value, path) {
      if (value !== this._lit) return err([mkIssue(path, `Must equal "${this._lit}"`)]);
      return ok(value);
    }
  }

  // ── ZUnion ───────────────────────────────────────────────────
  class ZUnion extends ZSchema {
    constructor(schemas) { super(); this._schemas = schemas; }
    _parse(value, path) {
      for (const s of this._schemas) {
        const r = s.safeParse(value);
        if (r.success) return r;
      }
      return err([mkIssue(path, 'No matching type in union')]);
    }
  }

  // ── ZArray ───────────────────────────────────────────────────
  class ZArray extends ZSchema {
    constructor(schema) { super(); this._schema = schema; }
    _parse(value, path) {
      if (!Array.isArray(value)) return err([mkIssue(path, 'Expected array')]);
      const issues = [];
      const out    = [];
      value.forEach((item, i) => {
        const r = this._schema.safeParse(item);
        if (!r.success) r.error.issues.forEach(iss => issues.push({ ...iss, path: `${path}[${i}]` }));
        else out.push(r.data);
      });
      return issues.length ? err(issues) : ok(out);
    }
    nonempty(msg) { return this._addCheck((v, p) => v.length === 0 ? mkIssue(p, msg || 'Array cannot be empty') : null); }
    min(n, msg)   { return this._addCheck((v, p) => v.length < n   ? mkIssue(p, msg || `Min ${n} item(s)`) : null); }
    max(n, msg)   { return this._addCheck((v, p) => v.length > n   ? mkIssue(p, msg || `Max ${n} item(s)`) : null); }
  }

  // ── ZObject ──────────────────────────────────────────────────
  class ZObject extends ZSchema {
    constructor(shape) { super(); this._shape = shape; }
    _parse(value, path) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return err([mkIssue(path, 'Expected object')]);
      }
      const issues = [];
      const out    = {};
      for (const [key, schema] of Object.entries(this._shape)) {
        const fieldPath = path ? `${path}.${key}` : key;
        const r = schema.safeParse(value[key]);
        if (!r.success) r.error.issues.forEach(i => issues.push({ ...i, path: fieldPath }));
        else out[key] = r.data;
      }
      return issues.length ? err(issues) : ok(out);
    }
    extend(shape)   { return new ZObject({ ...this._shape, ...shape }); }
    pick(keys)      { const s = {}; keys.forEach(k => { if (this._shape[k]) s[k] = this._shape[k]; }); return new ZObject(s); }
    omit(keys)      { const s = {}; Object.keys(this._shape).forEach(k => { if (!keys.includes(k)) s[k] = this._shape[k]; }); return new ZObject(s); }
    partial()       { const s = {}; Object.keys(this._shape).forEach(k => { s[k] = this._shape[k].optional(); }); return new ZObject(s); }
    shape()         { return this._shape; }
  }

  // ── ZFile (custom for browser uploads) ───────────────────────
  class ZFile extends ZSchema {
    _parse(value, path) {
      if (!(value instanceof File)) return err([mkIssue(path, 'Expected a file')]);
      const issues = this._runChecks(value, path);
      return issues.length ? err(issues) : ok(value);
    }
    maxSize(bytes, msg) { return this._addCheck((v, p) => v.size > bytes ? mkIssue(p, msg || `File too large (max ${(bytes/1024/1024).toFixed(1)} MB)`) : null); }
    accept(types, msg)  { return this._addCheck((v, p) => types.some(t => v.type.startsWith(t) || v.name.endsWith(t)) ? null : mkIssue(p, msg || `Invalid file type`)); }
  }

  // ── ZDate ────────────────────────────────────────────────────
  class ZDate extends ZSchema {
    _parse(value, path) {
      const d = value instanceof Date ? value : new Date(value);
      if (isNaN(d.getTime())) return err([mkIssue(path, 'Invalid date')]);
      const issues = this._runChecks(d, path);
      return issues.length ? err(issues) : ok(d);
    }
    min(d, msg) { return this._addCheck((v, p) => v < d ? mkIssue(p, msg || 'Date too early') : null); }
    max(d, msg) { return this._addCheck((v, p) => v > d ? mkIssue(p, msg || 'Date too late')  : null); }
  }

  // ── ZAny / ZUnknown ──────────────────────────────────────────
  class ZAny extends ZSchema     { _parse(v) { return ok(v); } }
  class ZUnknown extends ZSchema { _parse(v) { return ok(v); } }

  // ── ZRecord ──────────────────────────────────────────────────
  class ZRecord extends ZSchema {
    constructor(vs) { super(); this._vs = vs; }
    _parse(value, path) {
      if (typeof value !== 'object' || !value) return err([mkIssue(path, 'Expected record')]);
      const issues = []; const out = {};
      for (const [k, v] of Object.entries(value)) {
        const r = this._vs.safeParse(v);
        if (!r.success) r.error.issues.forEach(i => issues.push({ ...i, path: `${path}.${k}` }));
        else out[k] = r.data;
      }
      return issues.length ? err(issues) : ok(out);
    }
  }

  // ── ZRefine (custom schema from function) ────────────────────
  class ZRefine extends ZSchema {
    constructor(schema, fn, msg) { super(); this._schema = schema; this._fn = fn; this._msg = msg; }
    _parse(value, path) {
      const r = this._schema.safeParse(value);
      if (!r.success) return r;
      const pass = this._fn(r.data);
      if (!pass) return err([mkIssue(path, this._msg || 'Validation failed')]);
      return ok(r.data);
    }
  }

  // ── Public API ───────────────────────────────────────────────
  return {
    // Primitives
    string:  ()       => new ZString(),
    number:  ()       => new ZNumber(),
    boolean: ()       => new ZBoolean(),
    date:    ()       => new ZDate(),
    file:    ()       => new ZFile(),
    any:     ()       => new ZAny(),
    unknown: ()       => new ZUnknown(),

    // Complex
    enum:    (vals)   => new ZEnum(vals),
    literal: (val)    => new ZLiteral(val),
    union:   (schemas)=> new ZUnion(schemas),
    array:   (schema) => new ZArray(schema),
    object:  (shape)  => new ZObject(shape),
    record:  (vs)     => new ZRecord(vs),
    tuple:   (items)  => ({
      safeParse(value) {
        if (!Array.isArray(value)) return err([mkIssue('', 'Expected tuple array')]);
        const issues = [], out = [];
        items.forEach((s, i) => { const r = s.safeParse(value[i]); if (!r.success) r.error.issues.forEach(x => issues.push(x)); else out.push(r.data); });
        return issues.length ? err(issues) : ok(out);
      }
    }),

    // Refinement
    refine: (schema, fn, msg) => new ZRefine(schema, fn, msg),

    // Error class
    ZodError,

    // ── DUODROP SCHEMAS ──────────────────────────────────────
    schemas: {

      // User registration
      register: () => z.object({
        username: z.string().min(3, 'Username must be at least 3 characters').max(30).regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
        name:     z.string().min(2, 'Full name required').max(80),
        email:    z.string().email('Enter a valid email address'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        role:     z.enum(['fan', 'artist']),
        phone:    z.string().optional(),
        referral: z.string().optional(),
      }),

      // Login
      login: () => z.object({
        email:    z.string().email('Enter a valid email'),
        password: z.string().min(1, 'Password required'),
      }),

      // Song upload
      upload: () => z.object({
        title:     z.string().min(1, 'Song title is required').max(100),
        genre:     z.string().min(1, 'Please select a genre'),
        desc:      z.string().max(500, 'Description too long').optional(),
        tags:      z.string().optional(),
        type:      z.enum(['free', 'premium']),
        txref:     z.string().min(4, 'Transaction reference required'),
        amount:    z.number().min(5000, 'Upload fee is MK 5,000'),
        agree:     z.boolean().refine(v => v === true, 'You must confirm the agreement'),
      }),

      // Comment
      comment: () => z.object({
        text: z.string().min(1, 'Comment cannot be empty').max(500, 'Comment too long'),
      }),

      // Artist profile
      artistProfile: () => z.object({
        bio:       z.string().max(300).optional(),
        website:   z.string().url('Enter a valid URL').optional(),
        facebook:  z.string().optional(),
        instagram: z.string().optional(),
        twitter:   z.string().optional(),
      }),

      // Withdraw
      withdraw: () => z.object({
        amount:  z.number().min(1000, 'Minimum withdrawal: MK 1,000').int(),
        method:  z.enum(['airtel', 'mpamba', 'bank']),
        account: z.string().min(5, 'Enter valid account/phone number'),
      }),
    },

    // ── FORM HELPERS ──────────────────────────────────────────
    // Validate a form and display field errors automatically
    validateForm(schema, values, fieldMap = {}) {
      const result = schema.safeParse(values);
      // Clear previous errors
      Object.values(fieldMap).forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = ''; el.className = 'fe'; }
      });
      if (!result.success) {
        result.error.issues.forEach(issue => {
          const errId = fieldMap[issue.path] || `err-${issue.path}`;
          const el = document.getElementById(errId);
          if (el) { el.textContent = '⚠ ' + issue.message; el.className = 'fe show'; }
        });
      }
      return result;
    },

    // Show validation status badge
    showStatus(elId, result) {
      const el = document.getElementById(elId);
      if (!el) return;
      if (result.success) {
        el.innerHTML = '<span class="zod-ok">✅ Zod validation passed — all fields valid</span>';
      } else {
        const msgs = result.error.issues.map(i => `• ${i.message}`).join('<br>');
        el.innerHTML = `<span class="zod-fail">❌ Validation errors:<br>${msgs}</span>`;
      }
    },
  };
})();

// Export for modules
if (typeof module !== 'undefined') module.exports = { z };
