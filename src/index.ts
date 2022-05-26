import {EmailAddress} from "@kurtbuilds/lib"
import {
    BadRequestException,
    SendEmailCommand,
    SendEmailResponse,
    SESv2Client,
    SESv2ServiceException
} from "@aws-sdk/client-sesv2"
import * as fs from "fs";
import * as path from "path";

let _SES: null | SESv2Client = null
let _SENDER_EMAIL: null | EmailAddress = null
let _TEMPLATES: Record<string, EmailTemplate> = {}

interface ConfigureEmailClientOptions {
    from: EmailAddress,
    region: string,
    apiVersion: string,
    accessKeyId: string,
    secretAccessKey: string,
}


export function initialize(options: ConfigureEmailClientOptions) {
    if (_SES) {
        throw new Error("Email client already initialized.")
    }
    _SES = new SESv2Client({
        region: options.region,
        apiVersion: options.apiVersion,
        credentials: {
            accessKeyId: options.accessKeyId,
            secretAccessKey: options.secretAccessKey,
        },
    })
    _SENDER_EMAIL = options.from
    load_templates()
}


function get_client(): SESv2Client {
    if (!_SES) {
        throw new Error("Email client not initialized.")
    }
    return _SES
}


interface EmailTemplate {
    subject: string,
    body: string,
}


export function* walk(dir: string): Generator<string> {
    for (const filename of fs.readdirSync(dir)) {
        if (filename === 'node_modules') continue
        const fpath = path.join(dir, filename)
        if (fs.statSync(fpath).isDirectory()) yield* walk(fpath)
        else yield fpath
    }
}

export function load_email_template(path: string): EmailTemplate {
    let body = fs.readFileSync(path).toString().trim()
    let subject = ''
    while (body.substr(0, 4) === '<!--') {
        let end = body.indexOf('-->')
        let meta = body.substr(4,  end - 4)
        let [_, key, value] = /([^:]+):(.*)/.exec(meta)!.map(s => s.trim())
        if (key.toLowerCase() === 'subject') {
            subject = value
        } else {
            throw new Error(`Unrecognized meta field: ${key}`)
        }
        body = body.substr(end + 3).trim()
    }
    return {body, subject}
}


export function escape_html(unsafe: string): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


export function render_template(template_name: string, context: {[key: string]: string}): EmailTemplate {
    let template = _TEMPLATES[template_name]
    if (!template) {
        throw new Error(`Template ${template_name} not found.`)
    }
    let {body, subject} = template
    body = body.replace(/\${(\w+)}/g, (full_match, name) => {
        if (context[name] === undefined) {
            throw new Error('Tried to render template but variable not in context.')
        }
        return escape_html(context[name])
    })
    subject = subject.replace(/\${(\w+)}/g, (full_match, name) => {
        if (context[name] === undefined) {
            throw new Error('Tried to render template but variable not in context.')
        }
        return escape_html(context[name])
    })
    return {body, subject}
}

export async function send_email(to: EmailAddress, body: string, subject: string): Promise<SendEmailResponse> {
    const params = {
        FromEmailAddress: _SENDER_EMAIL!,
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
    }
    let res = await get_client().send(new SendEmailCommand(params))
    console.log('Sent AWS SES email', res)
    return res
}


function load_templates() {
    let dir_path = process.cwd()
    let src_path = path.join(dir_path, 'src')
    if (fs.existsSync(src_path)) {
        dir_path = src_path
    }
    console.log('Loading templates from dir:', dir_path)
    for (const fpath of walk(dir_path)) {
        if (!fpath.endsWith('.html')) continue
        let key = path.basename(fpath, '.html')
        console.log(`Loading template ${key}: ${fpath}`)
        _TEMPLATES[key] = load_email_template(fpath)
    }
}