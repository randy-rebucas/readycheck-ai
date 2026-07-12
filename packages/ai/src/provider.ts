export interface AIProvider {
  readonly name: string;
  complete(prompt: string): Promise<string>;
}
