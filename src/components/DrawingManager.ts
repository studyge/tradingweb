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

                                    getAll() {
                                        return this.drawings;
                                          }

                                            add(drawing: DrawingObject) {
                                                this.drawings.push(drawing);
                                                  }

                                                    remove(id: string) {
                                                        this.drawings = this.drawings.filter(d => d.id !== id);
                                                          }

                                                            clearSelection() {
                                                                this.drawings.forEach(d => d.selected = false);
                                                                  }

                                                                    select(id: string) {
                                                                        this.clearSelection();
                                                                            const obj = this.drawings.find(d => d.id === id);
                                                                                if (obj) obj.selected = true;
                                                                                  }

                                                                                    update(id: string, changes: Partial<DrawingObject>) {
                                                                                        const obj = this.drawings.find(d => d.id === id);
                                                                                            if (obj) Object.assign(obj, changes);
                                                                                              }
                                                                                              }
