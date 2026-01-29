import qoomEvent from "../../editer/utils/qoomEvent.js";

let state = null;

const assets = {
    close: "/view/applets/publisher/assets/ab1d94399957e76f55573113ee2b580c751a8270.svg",
    github: "/view/applets/publisher/assets/773671a5ff970d91c6801fbe611612367fc4af81.svg",
    githubLarge: "/view/applets/publisher/assets/eb0cc50cd47088ce12aa10818e1db911a2fa9bdc.svg",
    qoom: "/view/favicon.png",
    chevronRight: "/view/applets/publisher/assets/882dce62388e0cc724297c22ea144b8571d6c810.svg",
    chevronDown: "/view/applets/publisher/assets/565cef13462393062c83d6e2bf3d9db43136a820.svg",
    upload: "/view/applets/publisher/assets/8038f704c6498b79c830e5d3927c242977fbbcb5.svg"
};

const html2CanvasCdn = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";

function loadHtml2Canvas(targetDocument) {
    const existing = targetDocument.defaultView?.html2canvas;
    if (existing) {
        return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
        const script = targetDocument.createElement("script");
        script.src = html2CanvasCdn;
        script.async = true;
        script.onload = () => resolve(targetDocument.defaultView?.html2canvas);
        script.onerror = () => reject(new Error("Failed to load screenshot library"));
        targetDocument.head.appendChild(script);
    });
}

async function captureProjectScreenshot(projectUrl) {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-10000px";
    iframe.style.top = "0";
    iframe.style.width = "1280px";
    iframe.style.height = "720px";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const cleanup = () => {
        if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
        }
    };

    try {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Screenshot timed out"));
            }, 15000);

            iframe.onload = () => {
                clearTimeout(timeout);
                resolve();
            };
            iframe.onerror = () => {
                clearTimeout(timeout);
                reject(new Error("Failed to load project preview"));
            };

            iframe.src = projectUrl;
        });

        const iframeDocument = iframe.contentDocument;
        const iframeWindow = iframe.contentWindow;

        if (!iframeDocument || !iframeWindow) {
            throw new Error("Preview not available");
        }

        if (iframeDocument.fonts?.ready) {
            await iframeDocument.fonts.ready.catch(() => undefined);
        }

        await new Promise((resolve) => setTimeout(resolve, 500));

        const html2canvas = await loadHtml2Canvas(iframeDocument);
        if (!html2canvas) {
            throw new Error("Screenshot library unavailable");
        }

        const canvas = await html2canvas(iframeDocument.body, {
            useCORS: true,
            backgroundColor: "#ffffff",
            windowWidth: iframeWindow.innerWidth,
            windowHeight: iframeWindow.innerHeight,
            scrollX: 0,
            scrollY: 0,
            scale: 1
        });

        return canvas.toDataURL("image/png", 1.0);
    } finally {
        cleanup();
    }
}

async function resolveProjectPreviewUrl(projectPath) {
    const normalizedPath = projectPath.replace(/^\//, "");
    const isFilePath = /[^/]+\.[a-z0-9]+$/i.test(normalizedPath);
    const candidates = isFilePath
        ? [
            `/render/${normalizedPath}`
        ]
        : [
            `/view/${normalizedPath}/index.html`,
            `/view/${normalizedPath}/public/index.html`,
            `/view/${normalizedPath}/dist/index.html`,
            `/render/${normalizedPath}/index.html`
        ];

    for (const url of candidates) {
        try {
            const response = await fetch(url, { method: "GET" });
            if (response.ok) {
                return url;
            }
        } catch (error) {
            continue;
        }
    }

    throw new Error("Preview page not found");
}

function showMessage(message, type = "info") {
    const messageDiv = document.createElement("div");
    messageDiv.className = `upload-message upload-message-${type}`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

function getProjectFolderPath(path, isDirectory) {
    const normalizedPath = path.startsWith("/") ? path.substring(1) : path;
    const parts = normalizedPath.split("/");

    if (parts.length > 0) {
        if (parts.length === 1 && !isDirectory) {
            return null;
        }
        return parts[0];
    }
    return null;
}

function removeModal(id) {
    const existing = document.getElementById(id);
    if (existing) {
        existing.remove();
    }
}

function createModal(id, contentClass, innerHtml) {
    removeModal(id);
    const modal = document.createElement("div");
    modal.id = id;
    modal.className = "publisher-modal";
    modal.innerHTML = `<div class="publisher-modal-content ${contentClass}">${innerHtml}</div>`;
    document.body.appendChild(modal);
    return modal;
}

function bindModalClose(modal, closeSelector) {
    const closeButton = modal.querySelector(closeSelector);
    const closeModal = () => {
        modal.remove();
    };

    if (closeButton) {
        closeButton.addEventListener("click", closeModal);
    }

    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    const escHandler = (event) => {
        if (event.key === "Escape") {
            closeModal();
            document.removeEventListener("keydown", escHandler);
        }
    };
    document.addEventListener("keydown", escHandler);

    return closeModal;
}

function showPublishStartModal(path, isDirectory) {
    const projectFolderPath = getProjectFolderPath(path, isDirectory);
    if (!projectFolderPath) {
        showMessage("Project folder not found.", "error");
        return;
    }

    const projectName = projectFolderPath.split("/").pop() || projectFolderPath;
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

    const modal = createModal(
        "publisher-modal-start",
        "publisher-modal-content--md",
        `
        <div class="publisher-modal-header">
            <h3 class="publisher-modal-title">Publish Project</h3>
            <button type="button" class="publisher-close-btn" aria-label="Close">
                <img src="${assets.close}" alt="" />
            </button>
        </div>
        <div class="publisher-modal-body publisher-modal-body--stack">
            <div class="publisher-project-card">
                <span class="publisher-project-label">PROJECT:</span>
                <span class="publisher-project-name">${projectName}</span>
            </div>
            <p class="publisher-subtitle">Choose where to publish</p>
            <div class="publisher-options-list">
                <button type="button" class="publisher-option-card is-primary" data-option="github">
                    <span class="publisher-option-icon">
                        <img src="${assets.github}" alt="" />
                    </span>
                    <span class="publisher-option-text">
                        <span class="publisher-option-title">Publish to GitHub</span>
                        <span class="publisher-option-description">Push your project to a new or existing GitHub repository. Great for version control and collaboration.</span>
                    </span>
                    <span class="publisher-option-arrow">
                        <img src="${assets.chevronRight}" alt="" />
                    </span>
                </button>
                <button type="button" class="publisher-option-card" data-option="qoom">
                    <span class="publisher-option-icon">
                        <img src="${assets.qoom}" alt="" />
                    </span>
                    <span class="publisher-option-text">
                        <span class="publisher-option-title">Publish to Qoom Community</span>
                        <span class="publisher-option-description">Share your project with the Qoom community. Make it discoverable and get feedback.</span>
                    </span>
                    <span class="publisher-option-arrow">
                        <img src="${assets.chevronRight}" alt="" />
                    </span>
                </button>
            </div>
        </div>
        <div class="publisher-modal-footer publisher-modal-footer--end">
            <button type="button" class="publisher-btn publisher-btn-secondary" data-action="cancel">Cancel</button>
        </div>
        `
    );

    const closeModal = bindModalClose(modal, ".publisher-close-btn");

    modal.querySelector('[data-action="cancel"]').addEventListener("click", closeModal);

    modal.querySelectorAll(".publisher-option-card").forEach((button) => {
        button.addEventListener("click", () => {
            const option = button.dataset.option;
            closeModal();
            if (option === "github") {
                handleGitHubPublish(projectFolderPath);
            } else {
                showQoomPublishModal(projectFolderPath, normalizedPath);
            }
        });
    });
}

async function handleGitHubPublish(projectFolderPath) {
    let hasToken = false;

    try {
        const repoListResponse = await fetch("/migrate/getrepolist");
        if (repoListResponse.ok) {
            const repoData = await repoListResponse.json();
            if (repoData.success && repoData.resp) {
                hasToken = true;
            }
        }
    } catch (error) {
        hasToken = false;
    }

    if (!hasToken) {
        showConnectToGitHubModal(projectFolderPath);
        return;
    }

    showGitHubPublishModal(projectFolderPath);
}

function showConnectToGitHubModal(projectFolderPath) {
    const modal = createModal(
        "publisher-modal-connect",
        "publisher-modal-content--sm",
        `
        <div class="publisher-modal-header">
            <h3 class="publisher-modal-title">Connect to GitHub</h3>
            <button type="button" class="publisher-close-btn" aria-label="Close">
                <img src="${assets.close}" alt="" />
            </button>
        </div>
        <div class="publisher-modal-body publisher-modal-body--center">
            <div class="publisher-icon-stack">
                <img src="${assets.githubLarge}" alt="" />
            </div>
            <p class="publisher-center-title">Authentication Required</p>
            <p class="publisher-center-text">To publish projects to GitHub, you need to connect your GitHub account. This will redirect you to GitHub for authentication.</p>
        </div>
        <div class="publisher-modal-footer">
            <button type="button" class="publisher-btn publisher-btn-secondary" data-action="cancel">Cancel</button>
            <button type="button" class="publisher-btn publisher-btn-primary" data-action="continue">Continue to GitHub</button>
        </div>
        `
    );

    const closeModal = bindModalClose(modal, ".publisher-close-btn");

    modal.querySelector('[data-action="cancel"]').addEventListener("click", closeModal);
    modal.querySelector('[data-action="continue"]').addEventListener("click", () => {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set("github_publish", "true");
        currentUrl.searchParams.set("project_path", projectFolderPath);
        window.location.href = `/edit/publisher/_api/github/checktoken?url=${encodeURIComponent(currentUrl.toString())}`;
    });
}

async function showGitHubPublishModal(projectFolderPath) {
    const projectName = projectFolderPath.split("/").pop();
    let repoList = [];

    try {
        const repoListResponse = await fetch("/edit/publisher/_api/github/repos");
        if (repoListResponse.ok) {
            const repoData = await repoListResponse.json();
            repoList = repoData.data?.gitRepoList || [];
        }
    } catch (error) {
        repoList = [];
    }

    const repoOptions = repoList.length
        ? repoList.map((repo) => `<option value="${repo}">${repo}</option>`).join("")
        : "<option value=\"\" disabled>No repositories found</option>";

    const modal = createModal(
        "publisher-modal-github",
        "publisher-modal-content--lg",
        `
        <div class="publisher-modal-header">
            <h3 class="publisher-modal-title">Publish to GitHub</h3>
            <button type="button" class="publisher-close-btn" aria-label="Close">
                <img src="${assets.close}" alt="" />
            </button>
        </div>
        <div class="publisher-modal-body">
            <div class="publisher-repo-section">
                    <p class="publisher-subtitle">Choose how you want to publish:</p>
                <div class="publisher-repo-options">
                    <div class="publisher-repo-card is-selected" data-option="existing">
                        <span class="publisher-radio"><span class="publisher-radio-dot"></span></span>
                        <div class="publisher-option-text">
                            <p class="publisher-repo-title">Publish to Existing Repository</p>
                                <p class="publisher-repo-description">Pick a repo you already own. We'll push your project to it.</p>
                            <div class="publisher-field">
                                <span class="publisher-field-label">Select Repository</span>
                                <div class="publisher-select-wrap">
                                    <select class="publisher-select" data-role="repo-select">
                                        <option value="" selected disabled>Choose a repository...</option>
                                        ${repoOptions}
                                    </select>
                                    <img class="publisher-select-icon" src="${assets.chevronDown}" alt="" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="publisher-repo-card" data-option="new">
                        <span class="publisher-radio"></span>
                        <div class="publisher-option-text">
                            <p class="publisher-repo-title">Create New Repository</p>
                            <p class="publisher-repo-description">We'll create a new repo using your project name.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="publisher-modal-footer">
            <button type="button" class="publisher-btn publisher-btn-secondary" data-action="cancel">Cancel</button>
            <button type="button" class="publisher-btn publisher-btn-primary" data-action="publish" disabled>Publish</button>
        </div>
        `
    );

    const closeModal = bindModalClose(modal, ".publisher-close-btn");

    const optionCards = modal.querySelectorAll(".publisher-repo-card");
    const publishButton = modal.querySelector('[data-action="publish"]');
    optionCards.forEach((card) => {
        card.addEventListener("click", () => {
            optionCards.forEach((item) => item.classList.remove("is-selected"));
            card.classList.add("is-selected");
            updatePublishState();
        });
    });

    modal.querySelector('[data-action="cancel"]').addEventListener("click", closeModal);
    const updatePublishState = () => {
        const selectedCard = modal.querySelector(".publisher-repo-card.is-selected");
        const option = selectedCard ? selectedCard.dataset.option : "existing";
        if (option === "existing") {
            publishButton.disabled = !repoSelect.value;
        } else {
            publishButton.disabled = false;
        }
    };

    publishButton.addEventListener("click", async () => {
        const selectedCard = modal.querySelector(".publisher-repo-card.is-selected");
        const option = selectedCard ? selectedCard.dataset.option : "existing";
        let repoName = projectName;
        let existingRepo = "";

        if (option === "existing") {
            const select = modal.querySelector('[data-role="repo-select"]');
            existingRepo = select.value;
            if (!existingRepo) {
                showMessage("Please select a repository.", "error");
                return;
            }
        }

        closeModal();

        try {
            showMessage("Publishing to GitHub...", "info");
            const response = await fetch("/edit/publisher/_api/publish/github", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    projectPath: projectFolderPath,
                    isPrivate: false,
                    repoName: repoName,
                    existingRepo: existingRepo || undefined
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
                throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.success) {
                const repoUrl = data.data?.repoUrl || data.data?.html_url;
                if (repoUrl) {
                    showMessage(`Published! Repository: ${repoUrl}`, "success");
                    window.open(repoUrl, "_blank");
                } else {
                    showMessage("Published to GitHub!", "success");
                }
            } else {
                throw new Error(data.error || data.message || "Failed to publish to GitHub");
            }
        } catch (error) {
            showMessage(`Publish failed: ${error.message}`, "error");
        }
    });

    const repoSelect = modal.querySelector('[data-role="repo-select"]');
    repoSelect.addEventListener("change", () => {
        if (repoSelect.value) {
            repoSelect.classList.add("is-filled");
        } else {
            repoSelect.classList.remove("is-filled");
        }
        updatePublishState();
    });

    updatePublishState();
}

function showQoomPublishModal(projectFolderPath, projectPathOverride) {
    const projectName = projectFolderPath.split("/").pop();
    let coverImage = null;

    const modal = createModal(
        "publisher-modal-qoom",
        "publisher-modal-content--lg",
        `
        <div class="publisher-modal-header">
            <h3 class="publisher-modal-title">Publish to Qoom Community</h3>
            <button type="button" class="publisher-close-btn" aria-label="Close">
                <img src="${assets.close}" alt="" />
            </button>
        </div>
        <div class="publisher-modal-body">
            <div class="publisher-form">
                <div class="publisher-field">
                    <div class="publisher-field">
                    <div class="publisher-label-row">
                        <span class="publisher-label">Project Title</span>
                        <span class="publisher-required">*</span>
                    </div>
                    <input type="text" class="publisher-input" value="${projectName}" data-role="qoom-title" />
                </div>
                <div class="publisher-field">
                    <div class="publisher-label-row">
                        <span class="publisher-label">Description</span>
                        <span class="publisher-required">*</span>
                    </div>
                    <textarea class="publisher-textarea" placeholder="A short, clear description of your project." data-role="qoom-description"></textarea>
                </div>
                <div class="publisher-field">
                    <div class="publisher-label-row">
                        <span class="publisher-label">Cover Image</span>
                            <span class="publisher-optional">Optional</span>
                    </div>
                    <div class="publisher-cover-card">
                        <div class="publisher-cover-preview" data-role="qoom-cover-preview">
                            <span class="publisher-cover-placeholder">Add a cover image</span>
                        </div>
                        <button type="button" class="publisher-cover-btn" data-action="cover-screenshot">Take a Screenshot</button>
                        <button type="button" class="publisher-cover-link" data-action="cover-select">or Select a File</button>
                        <input type="file" data-role="qoom-cover-input" accept="image/*" style="display:none" />
                    </div>
                        <span class="publisher-hint">Optional. A cover image helps your project stand out.</span>
                </div>
            </div>
        </div>
        <div class="publisher-modal-footer">
            <button type="button" class="publisher-btn publisher-btn-secondary" data-action="cancel">Cancel</button>
                <button type="button" class="publisher-btn publisher-btn-primary" data-action="publish" disabled>Publish</button>
        </div>
        `
    );

    const closeModal = bindModalClose(modal, ".publisher-close-btn");

    const coverInput = modal.querySelector('[data-role="qoom-cover-input"]');
    const coverPreview = modal.querySelector('[data-role="qoom-cover-preview"]');
    const coverSelect = modal.querySelector('[data-action="cover-select"]');
    const coverScreenshot = modal.querySelector('[data-action="cover-screenshot"]');

    const setCoverPreview = (src) => {
        coverPreview.style.backgroundImage = `url('${src}')`;
        coverPreview.classList.add('is-filled');
        coverPreview.textContent = '';
    };

    coverSelect.addEventListener('click', () => {
        coverInput.click();
    });

    coverInput.addEventListener("change", () => {
        if (coverInput.files && coverInput.files[0]) {
            const file = coverInput.files[0];
            coverImage = { type: 'file', file };
            const previewUrl = URL.createObjectURL(file);
            setCoverPreview(previewUrl);
        }
    });

    coverScreenshot.addEventListener('click', async () => {
        coverScreenshot.disabled = true;
        const originalText = coverScreenshot.textContent;
        coverScreenshot.textContent = 'Taking Screenshot...';
        try {
            const normalizedPath = projectPathOverride ? projectPathOverride.replace(/^\//, "") : projectFolderPath;
            const projectUrl = await resolveProjectPreviewUrl(normalizedPath);
            const dataUrl = await captureProjectScreenshot(projectUrl);
            coverImage = { type: 'dataUrl', dataUrl };
            setCoverPreview(dataUrl);
        } catch (error) {
            showMessage(`Screenshot failed: ${error.message}`, 'error');
        } finally {
            coverScreenshot.disabled = false;
            coverScreenshot.textContent = originalText;
        }
    });

    const qoomPublishButton = modal.querySelector('[data-action="publish"]');
    const qoomTitleInput = modal.querySelector('[data-role="qoom-title"]');
    const qoomDescriptionInput = modal.querySelector('[data-role="qoom-description"]');

    const updateQoomPublishState = () => {
        const title = qoomTitleInput.value.trim();
        const description = qoomDescriptionInput.value.trim();
        qoomPublishButton.disabled = !(title && description);
    };

    qoomTitleInput.addEventListener("input", updateQoomPublishState);
    qoomDescriptionInput.addEventListener("input", updateQoomPublishState);

    modal.querySelector('[data-action="cancel"]').addEventListener("click", closeModal);
    qoomPublishButton.addEventListener("click", async () => {
        const title = modal.querySelector('[data-role="qoom-title"]').value.trim();
        const description = modal.querySelector('[data-role="qoom-description"]').value.trim();
        if (!title) {
            showMessage("Please enter a project title.", "error");
            return;
        }

        if (!description) {
            showMessage("Please enter a project description.", "error");
            return;
        }

        closeModal();
        await handleQoomPublish(projectFolderPath, title, description, coverImage);
    });

    updateQoomPublishState();
}

async function handleQoomPublish(projectFolderPath, title, description, coverImage) {
    try {
        showMessage("Publishing to Qoom Community...", "info");

        const mediaFiles = [];
        if (coverImage) {
            const resolvedMedia = await resolveCoverMedia(coverImage);
            if (resolvedMedia) {
                mediaFiles.push(resolvedMedia);
            }
        }

        const projectLink = `/~/${projectFolderPath}`;

        const projectData = {
            name: title,
            description: description,
            link: projectLink,
            displayType: "card",
            imgLink: "",
            submittoqoom: false,
            tags: []
        };

        const response = await fetch("/edit/publisher/_api/publish/qoom", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                folder: projectFolderPath,
                projectData: projectData,
                mediaFiles: mediaFiles
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
            throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success) {
            showMessage("Project successfully published to Qoom Community!", "success");
        } else {
            throw new Error(data.error || data.message || "Failed to publish to Qoom Community");
        }
    } catch (error) {
        showMessage(`Publish failed: ${error.message}`, "error");
    }
}

async function resolveCoverMedia(coverImage) {
    if (coverImage.type === 'file') {
        return readFileAsMedia(coverImage.file);
    }
    if (coverImage.type === 'base64') {
        return {
            path: 'cover.png',
            filename: 'cover.png',
            content: coverImage.base64,
            encoding: 'base64',
            contentType: coverImage.contentType || 'image/png'
        };
    }
    if (coverImage.type === 'dataUrl') {
        const base64 = coverImage.dataUrl.split(',')[1];
        const contentTypeMatch = coverImage.dataUrl.match(/data:(.*);base64/);
        return {
            path: 'cover.png',
            filename: 'cover.png',
            content: base64,
            encoding: 'base64',
            contentType: contentTypeMatch ? contentTypeMatch[1] : 'image/png'
        };
    }
    if (coverImage.type === 'url') {
        const response = await fetch(coverImage.url);
        if (!response.ok) {
            throw new Error('Failed to fetch cover image');
        }
        const blob = await response.blob();
        const file = new File([blob], 'cover.png', { type: blob.type || 'image/png' });
        return readFileAsMedia(file);
    }
    return null;
}

function readFileAsMedia(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve({
                path: file.name,
                filename: file.name,
                content: base64,
                encoding: 'base64',
                contentType: file.type || 'image/png',
                size: file.size
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function checkGitHubOAuthReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const githubPublish = urlParams.get("github_publish");
    let projectPath = urlParams.get("project_path");
    const listParam = urlParams.get("list");
    const codingspace = urlParams.get("codingspace");

    if (!projectPath && codingspace) {
        try {
            const decodedUrl = decodeURIComponent(codingspace);
            const originalUrl = new URL(decodedUrl);
            projectPath = originalUrl.searchParams.get("project_path");
        } catch (error) {
            projectPath = null;
        }
    }

    if ((githubPublish === "true" || listParam === "true") && projectPath) {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("github_publish");
        cleanUrl.searchParams.delete("project_path");
        cleanUrl.searchParams.delete("list");
        cleanUrl.searchParams.delete("code");
        cleanUrl.searchParams.delete("codingspace");
        window.history.replaceState({}, "", cleanUrl.toString());

        setTimeout(() => {
            showGitHubPublishModal(projectPath);
        }, 500);
    }
}

async function injectCSS() {
    if (document.querySelector('link[href*="publisher.css"]')) {
        return;
    }

    await new Promise((resolve, reject) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.type = "text/css";
        link.href = "/view/applets/publisher/frontend/publisher.css";

        link.onload = resolve;
        link.onerror = reject;

        document.head.appendChild(link);
    });
}

async function initialize(_state) {
    state = _state;
    await injectCSS();
    qoomEvent.on("publisher:open", (event) => {
        const { path, isDirectory } = event.detail || {};
        if (path) {
            showPublishStartModal(path, isDirectory);
        }
    });
    checkGitHubOAuthReturn();
}

export {
    initialize
};
