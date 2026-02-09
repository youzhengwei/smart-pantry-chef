/// <reference types="vite/client" />

declare const google: any;

declare global {
	interface Window {
		google: any;
	}
}
