export type DrawingType =
  | "horizontal"
    | "trend"
      | "rectangle"
        | "position";

        export interface Point {
          time: any;
            price: number;
            }

            export interface DrawingStyle {
              color: string;
                width: number;
                  dashed?: boolean;
                  }

                  export interface DrawingObject {
                    id: string;
                      type: DrawingType;
                        points: Point[];
                          selected: boolean;
                            locked: boolean;
                              visible: boolean;
                                style: DrawingStyle;
                                }

                                export class DrawingManager {
                                  private drawings: DrawingObject[] = [];
  private listeners: Map<string, Set<Function>> = new Map();

  getAll() {
    return this.drawings;
  }

  add(drawing: DrawingObject) {
    this.drawings.push(drawing);
    this.emit('change');
  }

  remove(id: string) {
    this.drawings = this.drawings.filter(d => d.id !== id);
    this.emit('delete');
  }

  removeSelected() {
    const hasSelected = this.drawings.some(d => d.selected);
    this.drawings = this.drawings.filter(d => !d.selected);
    if (hasSelected) {
      this.emit('delete');
    }
  }

  clearSelection() {
    const wasAnySelected = this.drawings.some(d => d.selected);
    this.drawings.forEach(d => d.selected = false);
    if (wasAnySelected) {
      this.emit('select');
    }
  }

  select(id: string) {
    this.clearSelection();
    const obj = this.drawings.find(d => d.id === id);
    if (obj) {
      obj.selected = true;
      this.emit('select');
    }
  }

  update(id: string, changes: Partial<DrawingObject>) {
    const obj = this.drawings.find(d => d.id === id);
    if (obj) {
      Object.assign(obj, changes);
      this.emit('change');
    }
  }

  on(event: string, handler: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: Function) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(handler);
    }
  }

  private emit(event: string) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(handler => handler());
    }
  }
}
