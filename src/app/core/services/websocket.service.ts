import { Injectable } from '@angular/core';
import { Client, Message } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private stompClient: Client;
  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  public isConnected$ = this.isConnectedSubject.asObservable();

  private subjects: { [topic: string]: Subject<any> } = {};
  private subscriptions: { [topic: string]: any } = {};

  constructor() {
    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(environment.apiUrl.replace('/api', '/ws')),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (msg: string) => {
        // console.log('[STOMP]', msg);
      }
    });

    this.stompClient.onConnect = (frame) => {
      console.log('Connected to WebSocket');
      this.isConnectedSubject.next(true);
      for (const topic in this.subjects) {
        this.subscribeToTopicInternal(topic);
      }
    };

    this.stompClient.onStompError = (frame) => {
      console.error('Broker reported error: ' + frame.headers['message']);
      console.error('Additional details: ' + frame.body);
    };

    this.stompClient.onWebSocketClose = () => {
      this.isConnectedSubject.next(false);
    };
  }

  public connect(): void {
    if (this.stompClient.active) return;
    
    const token = localStorage.getItem('token');
    if (token) {
      this.stompClient.connectHeaders = {
        'Authorization': Bearer  + token
      };
    }
    
    this.stompClient.activate();
  }

  public disconnect(): void {
    if (this.stompClient.active) {
      this.stompClient.deactivate();
      this.isConnectedSubject.next(false);
    }
  }

  public subscribeToProductividad(empleadoId: string | number): Observable<any> {
    const topic = `/topic/productividad/` + empleadoId;
    return this.getOrCreateSubject(topic);
  }

  private getOrCreateSubject(topic: string): Observable<any> {
    if (!this.subjects[topic]) {
      this.subjects[topic] = new Subject<any>();
      if (this.stompClient.connected) {
        this.subscribeToTopicInternal(topic);
      }
    }
    return this.subjects[topic].asObservable();
  }

  private subscribeToTopicInternal(topic: string) {
    if (this.subscriptions[topic]) return;

    this.subscriptions[topic] = this.stompClient.subscribe(topic, (message: Message) => {
      if (message.body) {
        try {
          const body = JSON.parse(message.body);
          this.subjects[topic].next(body);
        } catch (e) {
          this.subjects[topic].next(message.body);
        }
      }
    });
  }

  public unsubscribe(topic: string) {
    if (this.subscriptions[topic]) {
      this.subscriptions[topic].unsubscribe();
      delete this.subscriptions[topic];
    }
    if (this.subjects[topic]) {
      delete this.subjects[topic];
    }
  }
}
