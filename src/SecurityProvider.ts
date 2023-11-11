export type HTTPVerb = "get"|"post"|"put"|"delete"|"patch";

export interface SecurityProvider {
    securitySchemes: { [key: string]: any }
    securityForRoute(route: string, verbs: HTTPVerb[]): Promise<{ [key: string] : string[] }>
}