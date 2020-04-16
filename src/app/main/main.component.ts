import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import * as paper from 'paper';
import { DomSanitizer } from '@angular/platform-browser';
declare const $: any;

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit, OnDestroy {
  private layer: paper.Layer;
  private project: paper.Project
  private raster: paper.Raster;
  private markerStroke = 1;

  private coordinates: any = {};

  public latitude: string;
  public longitude: string;
  private pointNumber: number = 1;

  public downloadUrl: any = '';
  public importedFileName = '';

  public VERSION = '0.8';

  constructor(private sanitizer: DomSanitizer, private zone: NgZone) { }

  ngOnInit() {
    window['paper'] = paper;

    this.project = new paper.Project('main');
    this.layer = this.project.activeLayer;

    var toolPan = new paper.Tool()
    toolPan.activate()
    toolPan.onMouseDrag = function (event) {
      const delta = event.downPoint.subtract(event.point);
      (paper.view as any).scrollBy(delta)
    }

    let point;
    this.project.view.onMouseDown = (e) => {
      point = new paper.Point(e.event.clientX, e.event.clientY);
    }
    this.project.view.onMouseUp = (e) => {
      if (this.raster) {
        if (point.equals(new paper.Point(e.event.clientX, e.event.clientY))) {
          let local = this.raster.globalToLocal(e.point);
          local = local.add(new paper.Point(this.raster.width / 2, this.raster.height / 2));
          const localAbsolute = local.divide(new paper.Point(this.raster.width, this.raster.height));

          // this.pointNumber = (this.coordinates.x1) ? 2 : 1;
          this.coordinates['x' + this.pointNumber] = localAbsolute.x;
          this.coordinates['y' + this.pointNumber] = localAbsolute.y;

          this.latitude = '';
          this.longitude = '';
          $('#coordinatesModal').modal('show');

          window.scroll();
        }
      }
    }

    const horizontalLine = new paper.Path.Line(new paper.Point(-10000, 100), new paper.Point(20000, 100));
    horizontalLine.strokeColor = new paper.Color(.4);
    horizontalLine.strokeWidth = this.markerStroke;
    const verticalLine = new paper.Path.Line(new paper.Point(100, -10000), new paper.Point(100, 20000));
    verticalLine.strokeColor = new paper.Color(.4);
    verticalLine.strokeWidth = this.markerStroke;

    this.project.view.onMouseMove = (e: any) => {
      horizontalLine.position.y = e.point.y
      verticalLine.position.x = e.point.x
    }

    this.project.view.element.onwheel = (e) => {
      if (e.deltaY < 0) {
        if (this.project.view.zoom < 6) {
          this.project.view.zoom += 0.1;
        }
      } else {
        if (this.project.view.zoom > 0.2) {
          this.project.view.zoom -= 0.1;
        }
      }

      horizontalLine.strokeWidth = this.markerStroke / this.project.view.zoom;
      verticalLine.strokeWidth = this.markerStroke / this.project.view.zoom;
    }
  }

  validateCoordinates() {
    $('#coordinatesModal').modal('hide');

    for (const coord of ['latitude', 'longitude']) {
      const c = this[coord];
      if (c.match(/^\d+(\.\d+)?$/)) {
        console.log(coord + ' matches simple coord format');
        this.coordinates[coord + this.pointNumber] = parseFloat(c);
      } else if (c.match(/^\d+°(( )?\d+(')?)?$/)) {
        console.log(coord + ' matches radial format');
        const degrees = parseInt(c.split('°')[0]);
        let minutes = c.split('°')[1];
        minutes = minutes.match(/(\d+)/)[1];
        if (minutes.length == 1) {
          minutes = minutes + '0';
        }
        const fMinutes = parseInt(minutes);
        const decimal = (fMinutes / 60) * 100;
        const final = degrees + (decimal / 100);
        this.coordinates[coord + this.pointNumber] = final;
      } else {
        console.error(coord + ' have unknown format');
      }
    }

    this.latitude = null;
    this.longitude = null;

    if (this.pointNumber == 2) {
      const data = JSON.stringify(Object.assign({}, this.dumpedCoordinates));
      const blob = new Blob([data], { type: 'application/octet-stream' });
      this.downloadUrl = this.sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(blob));
    }

    this.pointNumber = (this.pointNumber == 2) ? 1 : 2;
    this.zone.run(() => {});
  }

  ngOnDestroy() {
    window['paper'] = null;
  }

  onFileChanged(e: any) {
    const file = e.target.files[0];
    if (file) {
      if (this.raster) {
        this.raster.remove();
      }
      this.importedFileName = file.name;
      switch(file.type) {
        case 'application/pdf':
          console.log('Trying to load in PDF');
          var reader = new FileReader();
          reader.onloadend = function (e) {
            console.log(reader.result);
          }
          reader.readAsBinaryString(file);
          break;
        case 'image/png':
          console.log('Trying to load in png');
          var reader = new FileReader();
          reader.onloadend = (e) => {
            this.raster = new paper.Raster(({
              source: reader.result,
              position: paper.view.center
            } as any));
            this.raster.sendToBack();
          }
          reader.readAsDataURL(file);
          break;
        default:
          console.error('Trying to load in unsupported file type');
          alert('Trying to load in unsupported file type');
          break;
      }
    }
  }

  get dumpedCoordinates() {
    return JSON.stringify({ calibration: this.coordinates }, null, 2);
  }
}
