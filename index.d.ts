import { EmailAddress } from "@kurtbuilds/lib";
import { SendEmailResponse } from "@aws-sdk/client-sesv2";
interface ConfigureEmailClientOptions {
    from: EmailAddress;
    region: string;
    apiVersion: string;
    accessKeyId: string;
    secretAccessKey: string;
}
export declare function initialize(options: ConfigureEmailClientOptions): void;
interface EmailTemplate {
    subject: string;
    body: string;
}
export declare function walk(dir: string): Generator<string>;
export declare function load_email_template(path: string): EmailTemplate;
export declare function escape_html(unsafe: string): string;
export declare function render_template(template_name: string, context: {
    [key: string]: string;
}): EmailTemplate;
export declare function send_email(to: EmailAddress, body: string, subject: string): Promise<SendEmailResponse>;
export {};
