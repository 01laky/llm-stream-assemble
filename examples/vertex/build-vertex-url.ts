export interface VertexStreamUrlOptions {
	projectId: string;
	location: string;
	/** Short model id or publishers/google/models/{model} segment */
	model: string;
	endpointId?: string;
}

export function buildVertexStreamUrl(options: VertexStreamUrlOptions): string {
	const base = `https://${options.location}-aiplatform.googleapis.com/v1/projects/${options.projectId}/locations/${options.location}`;
	if (options.endpointId) {
		return `${base}/endpoints/${options.endpointId}:streamGenerateContent`;
	}
	const model = options.model.includes("/")
		? options.model
		: `publishers/google/models/${options.model}`;
	return `${base}/${model}:streamGenerateContent`;
}

export function buildVertexGenerateUrl(options: VertexStreamUrlOptions): string {
	const stream = buildVertexStreamUrl(options);
	return stream.replace(":streamGenerateContent", ":generateContent");
}
