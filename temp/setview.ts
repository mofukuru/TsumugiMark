import { WorkspaceLeaf } from "obsidian";
import { VERTICAL_EDITOR_VIEW_TYPE } from "./verticaleditorview"

export async function setVert(leaf: WorkspaceLeaf) {
    await leaf.setViewState({
        type: VERTICAL_EDITOR_VIEW_TYPE,
        state: leaf.view.getState(),
    });
}

export async function setMark(leaf: WorkspaceLeaf) {
    await leaf.setViewState({
        type: "markdown",
        state: leaf.view.getState(),
    });
}
