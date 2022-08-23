import * as vscode from "vscode";

import { SolutionExplorerProvider } from "@SolutionExplorerProvider";
import { TreeItem } from "@tree";
import * as drop from "@tree/drop";
import { Action, ActionContext } from "@actions";

const SOLUTION_EXPLORER_MIME_TYPE = 'application/vnd.code.tree.solutionExplorer';
// const URI_LIST_MIME_TYPE = 'text/uri-list';

export class SolutionExplorerDragAndDropController extends vscode.Disposable implements vscode.TreeDragAndDropController<TreeItem> {
    private readonly dropHandlers: drop.DropHandler[];

    constructor(private readonly parent: SolutionExplorerProvider) {
        super(() => this.dispose());
        this.dropHandlers = [
            new drop.CopyExternalFileInProjects(),
            new drop.MoveFileInTheSameProject(),
            new drop.MoveFolderInTheSameProject(),
        ];
    }

    public get dropMimeTypes(): string[] {
		return [ SOLUTION_EXPLORER_MIME_TYPE ];
	}

	public get dragMimeTypes(): string[] {
		return [ ];
	}

    public async handleDrop(target: TreeItem | undefined, sources: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        if (!target) { return; }

        const treeItems = await this.getTreeItems(sources);
        if (token.isCancellationRequested) {
            return Promise.resolve();
        }

        const actions = await this.getDropActions(target, treeItems);
        if (token.isCancellationRequested) {
            return Promise.resolve();
        }

        const context: ActionContext = {
            multipleActions: actions.length > 1,
            overwriteAll: false,
            keepBothAll: false,
            skipAll: false,
            cancelled: false
        };

        for (const action of actions) {
            if (token.isCancellationRequested) {
                return Promise.resolve();
            }

            await action.execute(context);
        }

        return Promise.resolve();
    }

	public handleDrag(sources: TreeItem[], treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        if (token.isCancellationRequested) {
            return Promise.resolve();
        }

        const files = sources.map(s => s.id);
		treeDataTransfer.set(SOLUTION_EXPLORER_MIME_TYPE, new vscode.DataTransferItem(files));

        return Promise.resolve();
	}

    public dispose(): void {
		// nothing to dispose
	}

    private async getTreeItems(sources: vscode.DataTransfer): Promise<TreeItem[]> {
        const transferItem = sources.get(SOLUTION_EXPLORER_MIME_TYPE);
        if (!transferItem) {
            return [];
        }

        const children = await this.parent.getChildren() || [];
        const treeItems: TreeItem[] = [];
        for (const id of transferItem.value) {
            const treeItem = await SolutionExplorerDragAndDropController.getTreeItemById(id, children);
            if (treeItem) {
                treeItems.push(treeItem);
            }
        }

        return treeItems;
    }

    private async getDropActions(target: TreeItem, treeItems: TreeItem[]): Promise<Action[]> {
        const actions: Action[] = [];
        for(const treeItem of treeItems) {
            if (!treeItem) {
                continue;
            }

            for (const dropHandler of this.dropHandlers) {
                if (await dropHandler.canHandle(treeItem, target)) {
                    const actionsForTreeItem = await dropHandler.handle(treeItem, target);
                    actions.push(...actionsForTreeItem);
                }
            }
        }

        return actions;
    }

    private static async getTreeItemById(id: string, children: TreeItem[]): Promise<TreeItem | undefined> {
        for (const child of children) {
            if (!child) {
                continue;
            }
            console.log(`Comparing ${child.id}`);
            if (child.id === id) {
                return child;
            }

            const found = await SolutionExplorerDragAndDropController.getTreeItemById(id, (child as any).children || []);
            if (found) {
                return found;
            }
        }

        return undefined;
    }
}