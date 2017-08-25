/*
 * Copyright (C) 2017 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { ContainerModule } from 'inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from "@theia/core/lib/common/messaging";
import { Task } from './task';
import { ITaskClient, ITaskServer, taskPath } from '../common/task-protocol';
import { TaskServer } from './task-server';
import { TaskManager } from './task-manager';
import { TaskWatcher } from '../common/task-watcher';
import { ILogger } from '@theia/core/lib/common/logger';
import { TaskConfigurations } from './task-configurations';

export default new ContainerModule(bind => {

    bind(TaskManager).toSelf().inSingletonScope();
    bind(ITaskServer).to(TaskServer); // .inSingletonScope();
    bind(Task).toSelf().inTransientScope();
    bind(TaskWatcher).toSelf().inSingletonScope();
    bind(TaskConfigurations).toSelf();

    bind(ILogger).toDynamicValue(ctx => {
        const logger = ctx.container.get<ILogger>(ILogger);
        return logger.child({ 'module': 'task' });
    }).inSingletonScope().whenTargetNamed("task");

    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler<ITaskClient>(taskPath, client => {
            const taskServer = ctx.container.get<ITaskServer>(ITaskServer);
            taskServer.setClient(client);
            // when connection closes, cleanup instance of task-server
            client.onDidCloseConnection(() => {
                taskServer.dispose();
            });
            return taskServer;
        })
    ).inSingletonScope();
});

