"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.send_email = exports.render_template = exports.escape_html = exports.load_email_template = exports.walk = exports.initialize = void 0;
const client_sesv2_1 = require("@aws-sdk/client-sesv2");
const fs = require("fs");
const path = require("path");
let _SES = null;
let _SENDER_EMAIL = null;
let _TEMPLATES = {};
function initialize(options) {
    if (_SES) {
        throw new Error("Email client already initialized.");
    }
    _SES = new client_sesv2_1.SESv2Client({
        region: options.region,
        apiVersion: options.apiVersion,
        credentials: {
            accessKeyId: options.accessKeyId,
            secretAccessKey: options.secretAccessKey,
        },
    });
    _SENDER_EMAIL = options.from;
    load_templates();
}
exports.initialize = initialize;
function get_client() {
    if (!_SES) {
        throw new Error("Email client not initialized.");
    }
    return _SES;
}
function* walk(dir) {
    for (const filename of fs.readdirSync(dir)) {
        if (filename === 'node_modules')
            continue;
        const fpath = path.join(dir, filename);
        if (fs.statSync(fpath).isDirectory())
            yield* walk(fpath);
        else
            yield fpath;
    }
}
exports.walk = walk;
function load_email_template(path) {
    let body = fs.readFileSync(path).toString().trim();
    let subject = '';
    while (body.substr(0, 4) === '<!--') {
        let end = body.indexOf('-->');
        let meta = body.substr(4, end - 4);
        let [_, key, value] = /([^:]+):(.*)/.exec(meta).map(s => s.trim());
        if (key.toLowerCase() === 'subject') {
            subject = value;
        }
        else {
            throw new Error(`Unrecognized meta field: ${key}`);
        }
        body = body.substr(end + 3).trim();
    }
    return { body, subject };
}
exports.load_email_template = load_email_template;
function escape_html(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
exports.escape_html = escape_html;
function render_template(template_name, context) {
    let template = _TEMPLATES[template_name];
    if (!template) {
        throw new Error(`Template ${template_name} not found.`);
    }
    let { body, subject } = template;
    body = body.replace(/\${(\w+)}/g, (full_match, name) => {
        if (context[name] === undefined) {
            throw new Error('Tried to render template but variable not in context.');
        }
        return escape_html(context[name]);
    });
    subject = subject.replace(/\${(\w+)}/g, (full_match, name) => {
        if (context[name] === undefined) {
            throw new Error('Tried to render template but variable not in context.');
        }
        return escape_html(context[name]);
    });
    return { body, subject };
}
exports.render_template = render_template;
async function send_email(to, body, subject) {
    const params = {
        FromEmailAddress: _SENDER_EMAIL,
        ReplyToAddresses: [],
        Destination: {
            CcAddresses: [],
            ToAddresses: [to],
        },
        Content: {
            Simple: {
                Subject: {
                    Charset: 'UTF-8',
                    Data: subject
                },
                Body: {
                    Text: {
                        Charset: "UTF-8",
                        Data: "Please switch to an email client that supports HTML."
                    },
                    Html: {
                        Charset: "UTF-8",
                        Data: body,
                    }
                },
            },
        },
    };
    let res = await get_client().send(new client_sesv2_1.SendEmailCommand(params));
    console.log('Sent AWS SES email', res);
    return res;
}
exports.send_email = send_email;
function load_templates() {
    let dir_path = process.cwd();
    let src_path = path.join(dir_path, 'src');
    if (fs.existsSync(src_path)) {
        dir_path = src_path;
    }
    console.log('Loading templates from dir:', dir_path);
    for (const fpath of walk(dir_path)) {
        if (!fpath.endsWith('.html'))
            continue;
        let key = path.basename(fpath, '.html');
        console.log(`Loading template ${key}: ${fpath}`);
        _TEMPLATES[key] = load_email_template(fpath);
    }
}
//# sourceMappingURL=index.js.map